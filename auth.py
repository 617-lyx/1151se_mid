# auth.py —— 檢查登入與角色
from fastapi import Request, HTTPException


def chkLogin(role=None):
	"""
	用法：user = Depends(chkLogin("author"))
	- role=None：只回傳目前登入者（沒登入回傳 None）
	- role="author"/"editor"：
	    沒登入 → 導向登入頁
	    角色不對 → 403 沒有權限
	"""
	def checker(request: Request):
		loginUser = request.session.get("user")
		if role is None:
			return loginUser
		if loginUser is None:
			# 303 + Location：讓瀏覽器自動跳到登入頁
			raise HTTPException(status_code=303, headers={"Location": "/w/login.html"})
		if loginUser["role"] != role:
			raise HTTPException(status_code=403, detail="沒有權限")
		return loginUser
	return checker
