# routes/editor.py —— 編輯功能
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from db import getDB
from auth import chkLogin
from common import templates, flash

router = APIRouter()


# 1. 查看待審查清單（作者、類別、標題、文章大綱）
#    JOIN users 才拿得到作者的 nickname
@router.get("/list")
async def reviewList(request: Request, db=Depends(getDB), user=Depends(chkLogin("editor"))):
	cur = await db.execute("""
		SELECT a.aid, u.nickname, a.category, a.title, a.outline, a.updated_at
		FROM articles a JOIN users u ON a.author = u.id
		WHERE a.status = '審查中' ORDER BY a.updated_at, a.aid;""")
	data = await cur.fetchall()
	return templates.TemplateResponse(name="editorList.html", request=request,
		context={"articles": data, "user": user})


# 2. 已審查稿件：列出每一筆審查紀錄（通過 / 退回），可依結果篩選
#    reviews JOIN articles 拿稿件資料，再 JOIN users 兩次：一次拿作者名字、一次拿編輯名字
@router.get("/reviewed")
async def reviewedList(request: Request, result: str = "", db=Depends(getDB), user=Depends(chkLogin("editor"))):
	sql = """
		SELECT r.rid, r.result, r.reviewed_at, a.aid, a.category, a.title, a.status,
		       au.nickname AS author, ed.nickname AS editor
		FROM reviews r
		JOIN articles a ON r.aid = a.aid
		JOIN users au ON a.author = au.id
		JOIN users ed ON r.editor = ed.id"""
	if result in ("通過", "退回"):
		cur = await db.execute(sql + " WHERE r.result = %s ORDER BY r.reviewed_at DESC, r.rid DESC;", (result,))
	else:
		result = ""
		cur = await db.execute(sql + " ORDER BY r.reviewed_at DESC, r.rid DESC;")
	data = await cur.fetchall()
	cur = await db.execute("SELECT result, count(*) AS n FROM reviews GROUP BY result;")
	counts = {row["result"]: row["n"] for row in await cur.fetchall()}
	return templates.TemplateResponse(name="editorReviewed.html", request=request,
		context={"reviews": data, "user": user, "result": result,
		         "counts": counts, "total": sum(counts.values())})


# 3. 查看稿件內容：可以看「審查中」的，或「審查過」的稿件
@router.get("/view/{aid}")
async def view(aid: int, request: Request, db=Depends(getDB), user=Depends(chkLogin("editor"))):
	cur = await db.execute("""
		SELECT a.*, u.nickname
		FROM articles a JOIN users u ON a.author = u.id
		WHERE a.aid = %s
		  AND (a.status = '審查中' OR EXISTS (SELECT 1 FROM reviews r WHERE r.aid = a.aid));""", (aid,))
	data = await cur.fetchone()
	if data is None:
		flash(request, "此稿件不在審查中", ok=False)
		return RedirectResponse(url="/editor/list", status_code=302)
	reviews = await getReviews(db, aid)
	return templates.TemplateResponse(name="articleView.html", request=request,
		context={"data": data, "user": user, "reviews": reviews})


# 4. 選擇通過：審查中 => 已通過，並記一筆審查紀錄
@router.post("/pass/{aid}")
async def approve(aid: int, request: Request, db=Depends(getDB), user=Depends(chkLogin("editor"))):
	ok = await review(db, aid, user["id"], "通過", "已通過")
	flash(request, "稿件已通過" if ok else "只有「審查中」的稿件可以通過", ok=ok)
	return RedirectResponse(url="/editor/list", status_code=303)


# 5. 退回稿件：審查中 => 編輯中，並記一筆審查紀錄
@router.post("/reject/{aid}")
async def reject(aid: int, request: Request, db=Depends(getDB), user=Depends(chkLogin("editor"))):
	ok = await review(db, aid, user["id"], "退回", "編輯中")
	flash(request, "稿件已退回給作者" if ok else "只有「審查中」的稿件可以退回", ok=ok)
	return RedirectResponse(url="/editor/list", status_code=303)


async def review(db, aid: int, editor: str, result: str, newStatus: str) -> bool:
	"""改稿件狀態 + 新增審查紀錄。
	用 transaction（交易）包起來：兩個動作一起成功，或一起取消，不會只做一半。"""
	async with db.transaction():
		cur = await db.execute(
			"UPDATE articles SET status=%s, updated_at=now() WHERE aid=%s AND status='審查中';",
			(newStatus, aid))
		if cur.rowcount != 1:  # 不是審查中 → 什麼都不做
			return False
		await db.execute("INSERT INTO reviews (aid, editor, result) VALUES (%s, %s, %s);",
			(aid, editor, result))
	return True


async def getReviews(db, aid: int):
	"""某篇稿件的審查紀錄（作者、編輯查看稿件時都會顯示）"""
	cur = await db.execute("""
		SELECT r.result, r.reviewed_at, u.nickname AS editor
		FROM reviews r JOIN users u ON r.editor = u.id
		WHERE r.aid = %s ORDER BY r.reviewed_at, r.rid;""", (aid,))
	return await cur.fetchall()
