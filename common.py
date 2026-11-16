# common.py —— 各個 router 共用的東西
from fastapi import Request
from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory="templates")

# 稿件類別（新增/編輯時的下拉選單，後端也會檢查只能是這幾個）
CATEGORIES = ["科技", "生活", "文學", "教育", "其他"]


def flash(request: Request, msg: str, ok: bool = True):
	"""存一則提示訊息到 session，下一頁 base.html 會顯示一次後清掉"""
	request.session["flash"] = {"msg": msg, "ok": ok}
