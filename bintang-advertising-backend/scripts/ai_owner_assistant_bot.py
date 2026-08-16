import os
import sys
import json
import urllib.request

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

from django.utils import timezone
from api.models import Order
from api.pos_models import POSSale
from api import executive_dashboard

def generate_report():
    today = timezone.localdate()
    
    # Calculate daily metrics
    pos_today = POSSale.objects.filter(created_at__date=today, status='paid')
    pos_total = sum(p.total for p in pos_today)
    
    orders_today = Order.objects.filter(waktu__date=today).exclude(status_global='batal')
    orders_total = sum(o.total_harga for o in orders_today)
    
    total_revenue = pos_total + orders_total
    total_customers = pos_today.count() + orders_today.count()
    
    # Fetch executive dashboard summary
    exec_data = executive_dashboard.build('mtd')
    
    data_payload = {
        "tanggal": str(today),
        "pelanggan_hari_ini": total_customers,
        "uang_masuk_pos_hari_ini": float(pos_total),
        "uang_masuk_order_hari_ini": float(orders_total),
        "total_uang_masuk_hari_ini": float(total_revenue),
        "ringkasan_bulan_ini_mtd": {
            "pendapatan": float(exec_data.get('pendapatan', {}).get('nilai', 0)),
            "hpp": float(exec_data.get('hpp', {}).get('nilai', 0)),
            "laba_kotor": float(exec_data.get('laba_kotor', {}).get('nilai', 0)),
            "pesanan_count": exec_data.get('pesanan', {}).get('nilai', 0),
        }
    }
    
    # Send to 9router AI
    system_prompt = (
        "Kamu adalah AI Executive Advisor & Assistant cerdas Pemilik Percetakan Bintang Advertising. "
        "Tugasmu adalah menganalisis data keuangan realtime berikut dan membuat laporan executive "
        "singkat, ramah, profesional, dan kaya insight untuk WhatsApp Owner.\n"
        "Gunakan format WhatsApp (emoji, bold, bullet points) dan berikan 1-2 saran strategis bisnis."
    )
    
    user_prompt = f"Tolong buatkan laporan executive harian berdasarkan data realtime berikut:\n{json.dumps(data_payload, indent=2)}"
    
    req_body = json.dumps({
        "model": "ag/gemini-3-flash",
        "stream": False,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    }).encode('utf-8')
    
    req = urllib.request.Request(
        "http://localhost:20128/v1/chat/completions",
        data=req_body,
        headers={
            "Authorization": "Bearer sk-4588b0af8d884f08-imvqu5-1b31860d",
            "Content-Type": "application/json"
        }
    )
    
    ai_reply = "Laporan tidak dapat dihasilkan dari AI."
    try:
        with urllib.request.urlopen(req) as resp:
            res_data = json.loads(resp.read().decode('utf-8'))
            ai_reply = res_data['choices'][0]['message']['content']
    except Exception as e:
        ai_reply = f"Laporan Keuangan Hari Ini ({today}):\n- Pelanggan: {total_customers}\n- Total Uang Masuk: Rp {total_revenue:,.0f}\n(AI Gateway Error: {e})"
    
    print("\n=================== LAPORAN AI UNTUK OWNER ===================")
    print(ai_reply)
    print("==============================================================")
    
    # Send to WhatsApp via VPS Evolution API (using SSH tunnel for 100% reliability)
    try:
        import paramiko
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect('38.253.224.40', port=40186, username='root', password='pws@9921', timeout=15)
        
        target_wa = "62882007563131@s.whatsapp.net"
        wa_payload = json.dumps({
            "number": target_wa,
            "text": ai_reply
        })
        
        cmd = f"curl -s -X POST -H 'apikey: LocalTestingApiKey123' -H 'Content-Type: application/json' -d '{wa_payload}' http://localhost:8080/message/sendText/bintang_instance"
        _, stdout, _ = client.exec_command(cmd)
        wa_res = stdout.read().decode()
        client.close()
        
        print(f"\n[SUCCESS] Laporan berhasil dikirimkan ke WhatsApp Anda ({target_wa})!")
        print(f"Response WA API: {wa_res}")
    except Exception as e:
        print(f"\n[INFO] Gagal mengirim via WA API: {e}")

if __name__ == '__main__':
    generate_report()
