@echo off
cd /D D:\PendziuchLabs\LTA
echo Starting server... > D:\PendziuchLabs\LTA\server.log
npm run dev >> D:\PendziuchLabs\LTA\server.log 2>&1
