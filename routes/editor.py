# routes/editor.py —— 編輯功能
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from db import getDB
from auth import chkLogin
from common import templates, flash

router = APIRouter()


# 1. 查看待審查清單（作者、類別、標題）
#    JOIN users 才拿得到作者的 nickname
@router.get("/list")
async def reviewList(request: Request, db=Depends(getDB), user=Depends(chkLogin("editor"))):
	cur = await db.execute("""
		SELECT a.aid, u.nickname, a.category, a.title, a.updated_at
		FROM articles a JOIN users u ON a.author = u.id
		WHERE a.status = '審查中' ORDER BY a.updated_at, a.aid;""")
	data = await cur.fetchall()
	return templates.TemplateResponse(name="editorList.html", request=request,
		context={"articles": data, "user": user})


# 2. 查看稿件內容（只能看「審查中」的）
@router.get("/view/{aid}")
async def view(aid: int, request: Request, db=Depends(getDB), user=Depends(chkLogin("editor"))):
	cur = await db.execute("""
		SELECT a.*, u.nickname
		FROM articles a JOIN users u ON a.author = u.id
		WHERE a.aid = %s AND a.status = '審查中';""", (aid,))
	data = await cur.fetchone()
	if data is None:
		flash(request, "此稿件不在審查中", ok=False)
		return RedirectResponse(url="/editor/list", status_code=302)
	return templates.TemplateResponse(name="articleView.html", request=request,
		context={"data": data, "user": user})


# 3. 選擇通過：審查中 => 已通過
@router.post("/pass/{aid}")
async def approve(aid: int, request: Request, db=Depends(getDB), user=Depends(chkLogin("editor"))):
	cur = await db.execute(
		"UPDATE articles SET status='已通過', updated_at=now() WHERE aid=%s AND status='審查中';", (aid,))
	if cur.rowcount == 1:
		flash(request, "稿件已通過")
	else:
		flash(request, "只有「審查中」的稿件可以通過", ok=False)
	return RedirectResponse(url="/editor/list", status_code=303)


# 4. 退回稿件：審查中 => 編輯中
@router.post("/reject/{aid}")
async def reject(aid: int, request: Request, db=Depends(getDB), user=Depends(chkLogin("editor"))):
	cur = await db.execute(
		"UPDATE articles SET status='編輯中', updated_at=now() WHERE aid=%s AND status='審查中';", (aid,))
	if cur.rowcount == 1:
		flash(request, "稿件已退回給作者")
	else:
		flash(request, "只有「審查中」的稿件可以退回", ok=False)
	return RedirectResponse(url="/editor/list", status_code=303)
