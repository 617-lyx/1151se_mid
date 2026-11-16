# db.py —— 資料庫連線（PostgreSQL 連線池）
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from psycopg_pool import AsyncConnectionPool
from psycopg.rows import dict_row

# 連線字串格式：postgresql://帳號:密碼@主機:port/資料庫名稱
# 如果你的密碼或資料庫名稱不同，改這一行（或設定環境變數 DATABASE_URL）
DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:123456@localhost:5432/mydb")


# lifespan：伺服器啟動時建立連線池，關閉時釋放
@asynccontextmanager
async def lifespan(app: FastAPI):
	app.state.pool = AsyncConnectionPool(
		conninfo=DB_URL,
		kwargs={"row_factory": dict_row, "autocommit": True},  # dict_row：查詢結果用 欄位名稱 取值
		open=False,
	)
	await app.state.pool.open()
	print("✅ Connected to DB")
	yield
	await app.state.pool.close()
	print("🛑 Disconnected from DB")


# diagnose：連線池連不上時，直接連一次資料庫，取得真正的錯誤原因（密碼錯、資料庫不存在…）
async def diagnose():
	import psycopg
	try:
		conn = await psycopg.AsyncConnection.connect(DB_URL, connect_timeout=5)
		await conn.close()
		return None
	except Exception as e:
		return str(e).strip()


# getDB：每個請求從連線池借一條連線，用完自動歸還
async def getDB(request: Request):
	async with request.app.state.pool.connection() as conn:
		yield conn
