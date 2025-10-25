# Center-Automation

플라잉재팬 아르바이트 근무자들이 간단하게 스스로 스케줄을 꾸릴 수 있도록 만든 싱글 페이지 웹앱입니다.  
오전(09:00-15:00)은 2명, 오후(15:00-21:00)는 1명까지 배정되도록 제한해 중복 근무를 막습니다.

## 특징
- 월별 달력 뷰: 이전/다음 달 이동으로 전체 일정을 한눈에 확인
- 고정된 오전/오후 카드: 하루 2개의 슬롯이 항상 보여서 빈칸 확인이 빠름
- 슬롯 제어: 정원이 꽉 차면 자동으로 버튼 비활성화
- 배정 관리: 이름 클릭만으로 삭제 및 재배정
- 드롭다운 선택: 등록된 9명의 이름 중에서만 선택해 입력 오류 방지
- 서버 동기화: Flask API가 `data/schedule.json`에 JSON을 저장하고, 모든 사용자가 같은 데이터를 조회/수정

## 실행 방법
1. 가상환경 생성 (선택): `python3 -m venv .venv && source .venv/bin/activate`
2. 라이브러리 설치: `pip install -r requirements.txt`
3. 서버 실행
   - 개발 편의: `FLASK_APP=server.py flask run --reload`
   - 혹은 직접: `python3 server.py`
4. 브라우저에서 `http://localhost:5000` 접속

> 스케줄 데이터는 `data/schedule.json` 파일에 저장됩니다. 이 파일은 `.gitignore`에 포함돼 있어 실제 운영 데이터가 Git 이력에 섞이지 않습니다.

## 사용 방법
1. 날짜 카드에서 오전/오후 중 원하는 근무의 `+ 추가` 버튼을 클릭합니다.
2. 나타나는 드롭다운에서 이름을 선택하고 `저장`을 누르면 배정됩니다.
3. 이름을 삭제하려면 칩을 클릭하고 확인 창에서 승인합니다.

## 등록된 이름
- 함상훈, 표영군, 박은영
- 임소정, 이도우, 김가영
- 전유석, 윤재승, 이지수

## AWS EC2 배포 가이드

### 1. 사전 준비
- AWS EC2 인스턴스 (Amazon Linux 2023 또는 Ubuntu 권장)
- SSH 접속 가능한 상태
- Python 3.9 이상 설치

### 2. 작업 위치 확인
```bash
pwd  # 현재 위치 확인 (홈 디렉터리에서 시작 권장)
```

### 3. 배포 디렉터리 생성
```bash
sudo mkdir -p /var/www/center
sudo chown $USER:$USER /var/www/center
cd /var/www/center
```

### 4. 코드 내려받기
```bash
# 처음 클론하는 경우
git clone https://github.com/YourOrg/Center-Automation.git .

# 이미 클론되어 있는 경우
git pull origin main
```

### 5. 가상환경 설정
```bash
python3 -m venv .venv
source .venv/bin/activate  # 프롬프트 앞에 (.venv) 붙으면 성공
```

### 6. Python 의존성 설치
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 7. 데이터 폴더/파일 준비
```bash
mkdir -p data
echo '{}' > data/schedule.json
chmod 664 data/schedule.json
```

### 8. 동작 확인 (개발 서버)
```bash
FLASK_APP=server.py flask run --host 0.0.0.0 --port 5000
# 또는
python3 server.py
```

브라우저에서 `http://[EC2-PUBLIC-IP]:5000` 접속하여 확인

### 9. Gunicorn으로 프로덕션 실행
```bash
gunicorn --bind 0.0.0.0:5000 --workers 2 server:app
```

### 10. systemd 서비스 등록 (자동 시작)

`/etc/systemd/system/center-scheduler.service` 파일 생성:
```ini
[Unit]
Description=Center Scheduler Web Application
After=network.target

[Service]
Type=notify
User=ec2-user
Group=ec2-user
WorkingDirectory=/var/www/center
Environment="PATH=/var/www/center/.venv/bin"
ExecStart=/var/www/center/.venv/bin/gunicorn --bind 0.0.0.0:5000 --workers 2 server:app
Restart=always

[Install]
WantedBy=multi-user.target
```

서비스 시작:
```bash
sudo systemctl daemon-reload
sudo systemctl enable center-scheduler
sudo systemctl start center-scheduler
sudo systemctl status center-scheduler
```

### 11. Nginx 리버스 프록시 설정 (선택)

`/etc/nginx/conf.d/center.conf` 파일 생성:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static {
        alias /var/www/center;
        expires 30d;
    }
}
```

Nginx 재시작:
```bash
sudo systemctl restart nginx
```

### 12. 보안 그룹 설정
AWS EC2 콘솔에서 인바운드 규칙 추가:
- HTTP (포트 80): 0.0.0.0/0
- HTTPS (포트 443): 0.0.0.0/0 (SSL 설정 시)
- 또는 직접 접근: 포트 5000 (개발용)

### 트러블슈팅

**포트 5000이 이미 사용 중인 경우:**
```bash
sudo lsof -i :5000
sudo kill -9 [PID]
```

**서비스 로그 확인:**
```bash
sudo journalctl -u center-scheduler -f
```

**권한 문제:**
```bash
sudo chown -R $USER:$USER /var/www/center
chmod -R 755 /var/www/center
chmod 664 /var/www/center/data/schedule.json
```
