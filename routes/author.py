# routes/author.py —— 作者功能
# 每個 SQL 的 WHERE 都加上 author=自己 和 status='編輯中'，
# 所以就算有人直接打網址，也只能動「自己的」「編輯中」稿件
from fastapi import APIRouter, Depends, Request, Form
from fastapi.responses import RedirectResponse
from db import getDB
from auth import chkLogin
from common import templates, CATEGORIES, flash

router = APIRouter()


def checkForm(category: str, title: str, content: str):
	"""檢查表單內容，有錯就回傳錯誤訊息，沒錯回傳 None"""
	if category not in CATEGORIES:
		return "請選擇正確的類別"
	if not title.strip():
		return "標題不可空白"
	if len(title) > 100:
		return "標題不可超過 100 字"
	if not content.strip():
		return "文章內容不可空白"
	return None


# 1. 查看投稿稿件清單（類別、標題、審查狀態）—— 只看自己的，可依狀態篩選
@router.get("/list")
async def myList(request: Request, status: str = "", db=Depends(getDB), user=Depends(chkLogin("author"))):
	cur = await db.execute("SELECT * FROM articles WHERE author=%s ORDER BY aid;", (user["id"],))
	allData = await cur.fetchall()
	data = [a for a in allData if a["status"] == status] if status else allData
	counts = {s: sum(1 for a in allData if a["status"] == s) for s in ("編輯中", "審查中", "已通過")}
	return templates.TemplateResponse(name="authorList.html", request=request,
		context={"articles": data, "user": user, "status": status, "counts": counts, "total": len(allData)})


# 2-1. 新增投稿：顯示空白表單
@router.get("/new")
async def newForm(request: Request, user=Depends(chkLogin("author"))):
	return templates.TemplateResponse(name="articleEdit.html", request=request,
		context={"data": None, "user": user, "categories": CATEGORIES})


# 2-2. 新增投稿：存進資料庫，狀態 = 編輯中
@router.post("/add")
async def add(request: Request, category: str = Form(...), title: str = Form(...), content: str = Form(...),
              db=Depends(getDB), user=Depends(chkLogin("author"))):
	err = checkForm(category, title, content)
	if err:
		data = {"aid": None, "category": category, "title": title, "content": content}
		return templates.TemplateResponse(name="articleEdit.html", request=request, status_code=400,
			context={"data": data, "user": user, "categories": CATEGORIES, "error": err})
	await db.execute(
		"INSERT INTO articles (author, category, title, content, status) VALUES (%s, %s, %s, %s, '編輯中');",
		(user["id"], category, title.strip(), content))
	flash(request, "已新增投稿")
	return RedirectResponse(url="/author/list", status_code=303)


# 2-3. 編輯投稿：顯示表單（帶入原本內容）
@router.get("/edit/{aid}")
async def editForm(aid: int, request: Request, db=Depends(getDB), user=Depends(chkLogin("author"))):
	cur = await db.execute("SELECT * FROM articles WHERE aid=%s AND author=%s AND status='編輯中';",
		(aid, user["id"]))
	data = await cur.fetchone()
	if data is None:  # 不是自己的、或不是編輯中，不給改
		flash(request, "只有自己「編輯中」的稿件可以編輯", ok=False)
		return RedirectResponse(url="/author/list", status_code=302)
	return templates.TemplateResponse(name="articleEdit.html", request=request,
		context={"data": data, "user": user, "categories": CATEGORIES})


# 2-4. 編輯投稿：更新資料庫
@router.post("/update")
async def update(request: Request, aid: int = Form(...), category: str = Form(...), title: str = Form(...),
                 content: str = Form(...), db=Depends(getDB), user=Depends(chkLogin("author"))):
	err = checkForm(category, title, content)
	if err:
		data = {"aid": aid, "category": category, "title": title, "content": content}
		return templates.TemplateResponse(name="articleEdit.html", request=request, status_code=400,
			context={"data": data, "user": user, "categories": CATEGORIES, "error": err})
	cur = await db.execute(
		"UPDATE articles SET category=%s, title=%s, content=%s, updated_at=now() "
		"WHERE aid=%s AND author=%s AND status='編輯中';",
		(category, title.strip(), content, aid, user["id"]))
	if cur.rowcount == 1:  # rowcount = 被更新的筆數，0 代表條件不符
		flash(request, "已儲存")
	else:
		flash(request, "只有自己「編輯中」的稿件可以編輯", ok=False)
	return RedirectResponse(url="/author/list", status_code=303)


# 3. 刪除編輯中稿件
@router.post("/delete/{aid}")
async def delete(aid: int, request: Request, db=Depends(getDB), user=Depends(chkLogin("author"))):
	cur = await db.execute("DELETE FROM articles WHERE aid=%s AND author=%s AND status='編輯中';",
		(aid, user["id"]))
	if cur.rowcount == 1:
		flash(request, "稿件已刪除")
	else:
		flash(request, "只有自己「編輯中」的稿件可以刪除", ok=False)
	return RedirectResponse(url="/author/list", status_code=303)


# 4. 送出投稿：編輯中 => 審查中
@router.post("/submit/{aid}")
async def submit(aid: int, request: Request, db=Depends(getDB), user=Depends(chkLogin("author"))):
	cur = await db.execute(
		"UPDATE articles SET status='審查中', updated_at=now() WHERE aid=%s AND author=%s AND status='編輯中';",
		(aid, user["id"]))
	if cur.rowcount == 1:
		flash(request, "已送出投稿，等待編輯審查")
	else:
		flash(request, "只有自己「編輯中」的稿件可以送出", ok=False)
	return RedirectResponse(url="/author/list", status_code=303)


# 5. 查看自己的稿件內容（任何狀態都能看）
@router.get("/view/{aid}")
async def view(aid: int, request: Request, db=Depends(getDB), user=Depends(chkLogin("author"))):
	cur = await db.execute("""
		SELECT a.*, u.nickname
		FROM articles a JOIN users u ON a.author = u.id
		WHERE a.aid = %s AND a.author = %s;""", (aid, user["id"]))
	data = await cur.fetchone()
	if data is None:
		flash(request, "找不到此稿件", ok=False)
		return RedirectResponse(url="/author/list", status_code=302)
	return templates.TemplateResponse(name="articleView.html", request=request,
		context={"data": data, "user": user})
