# main.py —— 投稿審查系統
# 啟動：fastapi dev main.py   然後開 http://127.0.0.1:8000
from fastapi import FastAPI, Depends, Request
from starlette.exceptions import HTTPException  # 包含 FastAPI 的 HTTPException 與找不到網址的 404
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from db import lifespan
from auth import chkLogin
from common import templates

app = FastAPI(lifespan=lifespan)

# Session：登入後把使用者資料存在 session（瀏覽器 cookie 會帶著加密過的 session）
app.add_middleware(
	SessionMiddleware,
	secret_key="your-secret-key",
	max_age=None,       # 關掉瀏覽器就登出
	same_site="lax",
	https_only=False,
)

# 把三個 router 掛上來，prefix 是網址前綴
from routes.login import router as loginRoute
from routes.author import router as authorRoute
from routes.editor import router as editorRoute
app.include_router(loginRoute, prefix="/user")      # /user/login, /user/logout, /user/register
app.include_router(authorRoute, prefix="/author")   # 作者功能
app.include_router(editorRoute, prefix="/editor")   # 編輯功能

# 首頁：沒登入 → 登入頁；有登入 → 依角色進不同頁面
@app.get("/")
async def home(request: Request, user=Depends(chkLogin())):
	if user is None:
		return RedirectResponse(url="/w/login.html", status_code=302)
	if user["role"] == "author":
		return RedirectResponse(url="/author/list", status_code=302)
	else:
		return RedirectResponse(url="/editor/list", status_code=302)


# 錯誤處理：303 照原本的轉址；其他錯誤（例如 403 沒有權限）顯示錯誤頁
@app.exception_handler(HTTPException)
async def httpError(request: Request, exc: HTTPException):
	if exc.status_code in (302, 303) and exc.headers:
		return RedirectResponse(url=exc.headers["Location"], status_code=exc.status_code)
	return templates.TemplateResponse(name="error.html", request=request,
		context={"code": exc.status_code, "detail": exc.detail}, status_code=exc.status_code)


# 靜態網頁（登入、註冊、CSS）放在 www 資料夾，網址是 /w/檔名
app.mount("/w", StaticFiles(directory="www"))
