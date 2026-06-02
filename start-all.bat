@echo off
echo Starting MongoDB...
start "MongoDB" cmd /k "mkdir C:\data\db 2>nul && mongod --dbpath C:\data\db"
timeout /t 3

echo Starting Python ML Backend...
start "ML Backend" cmd /k "cd /d C:\Users\maha\OneDrive\Desktop\stock analysis\ml_backend && pip install -r requirements.txt && python -m uvicorn main:app --port 8000 --reload"
timeout /t 5

echo Starting Express Backend...
start "Express" cmd /k "cd /d C:\Users\maha\OneDrive\Desktop\stock analysis\backend && npm run dev"
timeout /t 3

echo Starting React Frontend...
start "React" cmd /k "cd /d C:\Users\maha\OneDrive\Desktop\stock analysis && npm start"

echo All services starting...
pause
