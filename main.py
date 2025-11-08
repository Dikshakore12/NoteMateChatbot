from flask import Flask, render_template, request, jsonify
import requests
import traceback
import re
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from urltotext import ContentFinder
import os
from dotenv import load_dotenv
from waitress import serve  # ✅ correct waitress import

# Load environment variables
load_dotenv()

# === SINGLE API KEY SETUP ===
API_KEY = os.getenv("OPENROUTER_API_KEY")

# === Flask Setup ===
app = Flask(__name__)
conversation_history = []
cf = ContentFinder()

# === Helper Functions ===
def clean_bot_response(text):
    text = re.sub(r'\(Note\s*\d*?:.*?\)', '', text)
    text = re.sub(r'\(Note:.*?\)', '', text)
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'\n{2,}', '\n', text)
    return text.strip()

def is_small_talk(message):
    greetings = ['hi', 'hello', 'hey', 'how are you', "what's up"]
    faqs = ['what can you do', 'who are you', 'your name', 'help']
    message = message.lower()
    for phrase in greetings + faqs:
        if phrase in message:
            return phrase
    return None

def get_headers():
    return {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

def try_api_request(payload):
    for _ in range(3):
        headers = get_headers()
        try:
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload
            )
            if response.status_code == 200:
                result = response.json()
                if result.get("choices"):
                    return result
        except Exception as e:
            print("Retrying due to:", str(e))
    return None

# === Routes ===
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_notes', methods=['POST'])
def get_notes():
    try:
        data = request.get_json()
        subject = data.get("subject", "General")
        topic = data.get("topic", "").strip()

        small_talk_type = is_small_talk(topic)
        if small_talk_type:
            responses = {
                "hi": "👋 Hello! How can I help you today?",
                "hello": "Hello there! 😊 What subject or topic would you like help with?",
                "hey": "Hey! I'm here to assist you. Ask me anything!",
                "how are you": "I'm doing great! Thanks for asking. How can I assist you today?",
                "what's up": "Not much, just helping awesome people like you! 😊",
                "what can you do": "I can help generate study notes, explain topics, and answer your questions in Hindi or English.",
                "who are you": "I'm <b>NoteMate</b>, your personal AI assistant for learning and teaching!",
                "your name": "My name is <b>NoteMate</b>. I’m here to assist you with notes and explanations!",
                "help": "Just enter a subject and topic — I’ll generate easy-to-read notes or answer your questions!"
            }
            return jsonify({"notes": responses.get(small_talk_type)})

        prompt = (
            f"Topic: '{topic}' from Subject: '{subject}'. "
            "Please respond in human conversational style. Use bold keywords. Exact and relevant answer only."
        )

        payload = {
            "model": "mistralai/mixtral-8x7b-instruct",
            "messages": [
                {"role": "system", "content": "You are NoteMate, an expert note-making assistant."},
                {"role": "user", "content": prompt}
            ]
        }

        result = try_api_request(payload)

        if not result:
            return jsonify({"error": "❌ API Error: All retries failed. Please try again later."}), 500

        reply = result["choices"][0]["message"]["content"]
        cleaned_reply = clean_bot_response(reply)

        conversation_history.append({"role": "user", "content": topic})
        conversation_history.append({"role": "assistant", "content": cleaned_reply})

        return jsonify({"notes": cleaned_reply})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"⚠️ Internal Server Error: {str(e)}"}), 500

@app.route('/fetch_website_content', methods=['POST'])
def fetch_website_content():
    try:
        data = request.get_json()
        url = data.get('url', '').strip()

        if not url:
            return jsonify({"error": "No URL provided"}), 400

        cf.scrape_url(url)
        article = cf.get_article(url)

        if not article:
            return jsonify({"error": "Could not extract content from the provided URL."}), 500

        summary_prompt = (
            "Summarize the following article into short study notes with bullet points. "
            "Highlight keywords using **bold** formatting:\n\n" + article
        )

        payload = {
            "model": "mistralai/mixtral-8x7b-instruct",
            "messages": [
                {"role": "system", "content": "You are NoteMate, an expert summarizer for educational articles."},
                {"role": "user", "content": summary_prompt}
            ]
        }

        result = try_api_request(payload)

        if not result:
            return jsonify({"error": "Failed to summarize article after retries."}), 500

        summary = result["choices"][0]["message"]["content"]
        cleaned_summary = clean_bot_response(summary)

        return jsonify({"content": cleaned_summary})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Failed to fetch or summarize content: {str(e)}"}), 500

@app.route('/extract-url', methods=['POST'])
def extract_url():
    try:
        data = request.get_json()
        url = data.get('url', '')

        if not url.startswith("http"):
            url = "http://" + url

        response = requests.get(url, timeout=5)
        soup = BeautifulSoup(response.text, 'html.parser')

        title = soup.title.string if soup.title else "No Title"
        paragraphs = soup.find_all('p')
        content = '\n\n'.join(p.text for p in paragraphs[:10])

        return jsonify({
            "success": True,
            "title": title,
            "content": content or "No content found on page."
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        })

# === Render / Production Entry Point ===
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 10000))  # Render provides this port
    serve(app, host='0.0.0.0', port=port)
