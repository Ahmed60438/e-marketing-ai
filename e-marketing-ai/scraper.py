import os
import json
import re
import time
from urllib.parse import urlparse, urljoin
import xml.etree.ElementTree as ET
import requests
from bs4 import BeautifulSoup

# إعدادات الموقع
BASE_URL = "https://www.e-marketingreviews.com/"
SITEMAP_URL = "https://www.e-marketingreviews.com/sitemap.xml"
OUTPUT_FILE = "data/knowledge_base.json"

# الحد الأقصى للصفحات للزحف (يمكنك زيادتها حسب حجم موقعك)
MAX_PAGES_TO_CRAWL = 300

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}

def clean_url(url):
    """تنظيف الرابط وإزالة البارامترات المكررة مثل ?m=1 الخاصة بالهواتف"""
    parsed = urlparse(url)
    # إزالة التكرار الخاص بنسخ الجوال لبلوجر
    clean_path = parsed.path
    return f"{parsed.scheme}://{parsed.netloc}{clean_path}".rstrip('/')

def clean_text(text):
    """تنظيف النصوص من المسافات والأسطر الزائدة"""
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def is_internal_url(url):
    """التحقق مما إذا كان الرابط ينتمي لنفس الموقع وليس رابطاً خارجياً"""
    parsed_base = urlparse(BASE_URL)
    parsed_url = urlparse(url)
    return parsed_base.netloc == parsed_url.netloc

def is_valid_page(url):
    """استبعاد الملفات والصور والروابط غير النصية"""
    ignored_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.css', '.js', '.pdf', '.zip']
    parsed = urlparse(url)
    path = parsed.path.lower()
    return not any(path.endswith(ext) for ext in ignored_extensions)

def get_urls_from_sitemaps(sitemap_url):
    """استخراج جميع الروابط من جميع خرائط الموقع المتاحة"""
    urls = set()
    try:
        print(f"🌐 فحص خرائط الموقع: {sitemap_url}")
        resp = requests.get(sitemap_url, headers=HEADERS, timeout=10)
        if resp.status_code == 200:
            root = ET.fromstring(resp.content)
            namespaces = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
            
            # البحث عن خرائط فرعية أو روابط مباشرة
            for loc in root.findall('.//ns:loc', namespaces) or root.findall('.//loc'):
                u = loc.text.strip() if loc.text else ""
                if u.endswith('.xml'):
                    urls.update(get_urls_from_sitemaps(u))
                elif u:
                    urls.add(clean_url(u))
    except Exception as e:
        print(f"⚠️ تنبيه أثناء جلب Sitemap: {e}")
    return urls

def get_urls_from_blogger_feeds():
    """جلب جميع المقالات والصفحات عبر Atom Feeds المخصصة لبلوجر"""
    urls = set()
    start_index = 1
    max_results = 150
    
    while True:
        feed_url = f"{BASE_URL}feeds/posts/default?alt=json&start-index={start_index}&max-results={max_results}"
        try:
            print(f"📡 جلب التغذية (Feed) بدءاً من المقال {start_index}...")
            resp = requests.get(feed_url, headers=HEADERS, timeout=10)
            if resp.status_code != 200:
                break
            
            data = resp.json()
            entries = data.get('feed', {}).get('entry', [])
            if not entries:
                break
                
            for entry in entries:
                for link in entry.get('link', []):
                    if link.get('rel') == 'alternate':
                        urls.add(clean_url(link.get('href')))
                        
            start_index += max_results
            if start_index > 1000: # حد أقصى للأمان
                break
        except Exception as e:
            print(f"⚠️ خطأ أثناء جلب Feed: {e}")
            break
            
    return urls

def deep_crawl_and_scrape():
    """الزاحف الشامل الذي يستكشف كل زاوية ورابط داخل الموقع"""
    visited_urls = set()
    urls_to_visit = set()
    articles_data = []

    # 1. تجميع الروابط المبدئية من Sitemaps و Feeds والصفحة الرئيسية
    print("🚀 بدء استكشاف الموقع وبناء خريطة الروابط الكلية...")
    urls_to_visit.add(clean_url(BASE_URL))
    urls_to_visit.update(get_urls_from_sitemaps(SITEMAP_URL))
    urls_to_visit.update(get_urls_from_blogger_feeds())

    print(f"📊 تم العثور على {len(urls_to_visit)} رابطاً أولياً للبدء في مسحهم وتحليلهم.\n")

    count = 0
    while urls_to_visit and count < MAX_PAGES_TO_CRAWL:
        current_url = urls_to_visit.pop()
        
        if current_url in visited_urls or not is_valid_page(current_url):
            continue
            
        visited_urls.add(current_url)
        count += 1
        
        print(f"[{count}/{MAX_PAGES_TO_CRAWL}] 🔍 قراءة وتحليل: {current_url}")
        
        try:
            resp = requests.get(current_url, headers=HEADERS, timeout=12)
            if resp.status_code != 200:
                continue
                
            soup = BeautifulSoup(resp.text, 'html.parser')

            # --- أ: اكتشاف وروابط جديدة داخل الصفحة لزحف عميق ---
            for a_tag in soup.find_all('a', href=True):
                href = a_tag['href']
                full_url = urljoin(current_url, href)
                cleaned = clean_url(full_url)
                
                if is_internal_url(cleaned) and cleaned not in visited_urls and is_valid_page(cleaned):
                    urls_to_visit.add(cleaned)

            # --- ب: استخراج المحتوى والبيانات من الصفحة ---
            title_tag = soup.find('h1') or soup.find('title')
            title = clean_text(title_tag.text) if title_tag else ""
            
            # استخراج محتوى الصفحة (سواء كان مقالاً أو صفحة ثابتة)
            body_content = soup.find('div', class_=re.compile(r'post-body|entry-content|post-content|widget-content'))
            if not body_content:
                body_content = soup.find('article') or soup.find('main') or soup.find('body')

            if body_content:
                # حذف العناصر غير النصية مثل الإعلانات والأكواد
                for tag in body_content(['script', 'style', 'nav', 'footer', 'iframe', 'header', 'noscript']):
                    tag.decompose()
                
                content = clean_text(body_content.get_text())
                
                if title and len(content) > 80: # التأكد من وجود نص ذو قيمة
                    articles_data.append({
                        "url": current_url,
                        "title": title,
                        "content": content
                    })
                    
        except Exception as e:
            print(f"❌ خطأ في قراءة الرابط {current_url}: {e}")

        time.sleep(0.1) # استراحة بسيطة لتفادي إرهاق السيرفر

    return articles_data

def main():
    os.makedirs("data", exist_ok=True)
    
    start_time = time.time()
    all_data = deep_crawl_and_scrape()
    
    # حفظ النتيجة الكلية
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
        
    execution_time = round(time.time() - start_time, 2)
    print("\n" + "="*50)
    print(f"🎉 تم مسح الموقع بالكامل بنجاح!")
    print(f"📌 إجمالي الصفحات والمقالات التي تم استخراجها: {len(all_data)}")
    print(f"📁 تم حفظ الذاكرة داخل: {OUTPUT_FILE}")
    print(f"⏱️ استغرق العمل: {execution_time} ثانية")
    print("="*50)

if __name__ == "__main__":
    main()