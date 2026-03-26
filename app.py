from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import io
import os
import hashlib
import time
from extractor import get_url_features
# Optional pre-checks: redirection, firewall, paywall, cached results
# DISABLED by default for upload speed (enable by setting ENABLE_PRECHECK=1 env var)
import os as _os_env
precheck_url = None
if _os_env.getenv('ENABLE_PRECHECK') == '1':
    try:
        from precheck import precheck_url
    except Exception:
        precheck_url = None

# Optional upload result caching
try:
    from cache_db import get_cached_result, store_cached_result
except Exception:
    get_cached_result = None
    store_cached_result = None

app = Flask(__name__)
# CRITICAL: This allows your React app (port 3000) to talk to this API (port 5000)
CORS(app, resources={r"/api/*": {"origins": "*"}}) 

print("✅ PoisonGuard AI Backend Ready!")
print("📍 Using Heuristic Phishing Detection (Accurate & Fast)")
print("🔒 Features: URL analysis, safe domain whitelist, red flag detection")

@app.route('/')
def home():
    return "AI Backend is LIVE on Port 5000"

# --- SINGLE URL ROUTE ---
@app.route('/api/predict', methods=['POST'])
def predict():
    data = request.get_json()
    url = data.get('url')
    print(f"🔍 Single Scan: {url}")
    
    if not url:
        return jsonify({"error": "No URL provided"}), 400
    
    try:
        # Use heuristic detector
        result = get_url_features(url)
        
        if "error" in result:
            return jsonify({"error": "Invalid URL"}), 400
        
        return jsonify({
            "url": url,
            "is_phishing": result["is_phishing"],
            "confidence": round(result["confidence"] * 100, 2),
            "reasons": result.get("reasons", [])
        })
    
    except Exception as e:
        print(f"❌ PREDICTION ERROR: {e}")
        return jsonify({"error": str(e)}), 500

# --- DATASET UPLOAD ROUTE ---
@app.route('/api/upload', methods=['POST'])
def upload_file():
    print("📂 Upload request received!")
    
    if 'file' not in request.files:
        print("❌ No file in request")
        return jsonify({"error": "No file"}), 400
    
    file = request.files['file']
    
    # Compute file hash for caching
    file_bytes = file.stream.read()
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    file.stream.seek(0)  # Reset stream for CSV reading
    file_size = len(file_bytes)
    filename = file.filename or 'unknown'
    
    print(f"📋 File: {filename}, Hash: {file_hash[:16]}..., Size: {file_size} bytes")
    
    # Check cache first
    if get_cached_result:
        cached = get_cached_result(file_hash)
        if cached:
            print(f"✅ Cache HIT! Returning cached result for {filename}")
            return jsonify({
                "total": cached['total'],
                "phishing_count": cached['phishing_count'],
                "safe_count": cached['safe_count'],
                "results": cached['results'],
                "from_cache": True,
                "cached_at": cached['checked_at']
            })
    
    try:
        # Read CSV
        stream = io.StringIO(file_bytes.decode("UTF8"), newline=None)
        df = pd.read_csv(stream)
        print(f"📊 CSV Loaded. Rows: {len(df)}")

        # Find URL column
        url_col = next((c for c in df.columns if 'url' in c.lower()), None)
        if not url_col:
            return jsonify({"error": "No 'url' column found in CSV"}), 400

        # Process URLs and get predictions
        total_rows = len(df)
        results = []
        phishing_count = 0
        safe_count = 0
        checked_at = time.time()
        
        # Process all URLs with heuristic detector
        for idx, url in enumerate(df[url_col]):
            try:
                # Run lightweight pre-check (non-blocking if module absent)
                pre = None
                try:
                    if precheck_url:
                        pre = precheck_url(str(url))
                except Exception as pre_err:
                    pre = {"error": f"precheck_failed: {pre_err}"}

                # Use heuristic detector
                result = get_url_features(str(url))
                
                if "error" in result:
                    results.append({
                        "url": str(url),
                        "is_phishing": False,
                        "confidence": 0,
                        "error": "Invalid URL"
                    })
                    continue
                
                is_phishing = result["is_phishing"]
                confidence = result["confidence"] * 100
                
                if is_phishing:
                    phishing_count += 1
                else:
                    safe_count += 1
                
                out = {
                    "url": str(url),
                    "is_phishing": bool(is_phishing),
                    "confidence": round(confidence, 2),
                    "reasons": result.get("reasons", [])
                }
                if pre is not None:
                    out["precheck"] = pre
                results.append(out)
                
                # Print progress every 50 rows
                if (idx + 1) % 50 == 0:
                    print(f"✅ Processed {idx + 1}/{total_rows} URLs")
                    
            except Exception as url_err:
                print(f"⚠️  Error processing URL at row {idx}: {url_err}")
                out_err = {
                    "url": str(url),
                    "is_phishing": False,
                    "confidence": 0,
                    "error": str(url_err)
                }
                try:
                    if precheck_url:
                        pre = precheck_url(str(url))
                        out_err["precheck"] = pre
                except Exception:
                    pass
                results.append(out_err)
        
        print(f"✅ Analysis Complete: {phishing_count} phishing, {safe_count} safe out of {total_rows}")
        
        response_data = {
            "total": total_rows,
            "phishing_count": phishing_count,
            "safe_count": safe_count,
            "results": results,
            "from_cache": False
        }
        
        # Store in cache
        if store_cached_result:
            try:
                store_cached_result(file_hash, filename, file_size, checked_at, total_rows, phishing_count, safe_count, results)
            except Exception as cache_err:
                print(f"⚠️ Cache store failed: {cache_err}")
        
        return jsonify(response_data)

    except Exception as e:
        print(f"❌ PROCESS ERROR: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)