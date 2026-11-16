# routes/login.py —— 登入、登出、註冊
from fastapi import APIRouter, Depends, Request, Form
from fastapi.responses import RedirectResponse
from db import getDB

router = APIRouter()


# 登入：比對帳號密碼，成功就把使用者存進 session
@router.post("/login")
async def login(request: Request,
                username: str = Form(...),
                password: str = Form(...),
                db=Depends(getDB)):
	cur = await db.execute("SELECT * FROM users WHERE id=%s AND pwd=%s;", (username, password))
	data = await cur.fetchone()
	if data is None:
		return RedirectResponse(url="/w/login.html?err=1", status_code=303)
	request.session["user"] = {"id": data["id"], "nickname": data["nickname"], "role": data["role"]}
	return RedirectResponse(url="/", status_code=303)


# 登出：清掉 session
@router.get("/logout")
async def logout(request: Request):
	request.session.clear()
	return RedirectResponse(url="/w/login.html", status_code=302)


# 註冊：新增一個使用者
@router.post("/register")
async def register(username: str = Form(...),
                   password: str = Form(...),
                   nickname: str = Form(...),
                   role: str = Form(...),
                   db=Depends(getDB)):
	username, nickname = username.strip(), nickname.strip()
	if role not in ("author", "editor"):
		return RedirectResponse(url="/w/register.html?err=role", status_code=303)
	if not username or not nickname or len(username) > 15 or len(nickname) > 30 or len(password) > 30:
		return RedirectResponse(url="/w/register.html?err=len", status_code=303)
	cur = await db.execute("SELECT id FROM users WHERE id=%s;", (username,))
	if await cur.fetchone():
		return RedirectResponse(url="/w/register.html?err=dup", status_code=303)
	await db.execute("INSERT INTO users (id, pwd, nickname, role) VALUES (%s, %s, %s, %s);",
		(username, password, nickname, role))
	return RedirectResponse(url="/w/login.html?ok=1", status_code=303)
