from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import io
import os
import hashlib
import time
from extractor import get_url_features, extract_ml_features
# Optional pre-checks: redirection, firewall, paywall, cached results
# DISABLED by default for upload speed (enable by setting ENABLE_PRECHECK=1 env var)
import os as _os_env
import importlib
precheck_url = None
if _os_env.getenv('ENABLE_PRECHECK') == '1':
    try:
        pre_mod = importlib.import_module('precheck')
        precheck_url = getattr(pre_mod, 'precheck_url', None)
    except Exception:
        precheck_url = None

# Optional upload result caching
try:
    from cache_db import get_cached_result, store_cached_result
except Exception:
    get_cached_result = None
    store_cached_result = None

# Load ML Model
model = None
feature_names = None
model_available = False

try:
    model = joblib.load('phishing_model_v2.pkl')
    feature_names = joblib.load('feature_names_v2.pkl')
    model_available = True
    print("✅ ML Model Loaded Successfully!")
except Exception as e:
    print(f"⚠️ ML Model not found or failed to load: {e}")
    print("📍 Falling back to Heuristic Phishing Detection")
    model_available = False

app = Flask(__name__)
# CRITICAL: This allows your React app (port 3000) to talk to this API (port 5000)
CORS(app, resources={r"/api/*": {"origins": "*"}}) 

print("✅ PoisonGuard AI Backend Ready!")
if model_available:
    print("🤖 Using ML Model-Based Detection (Maximum Accuracy)")
else:
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
        if model_available:
            # Use ML Model for prediction
            try:
                heuristic_result = get_url_features(url)
                
                if "error" in heuristic_result:
                    return jsonify({"error": "Invalid URL"}), 400
                
                # If heuristic says it's clearly phishing or safe, use that
                if heuristic_result["risk_score"] > 70 or heuristic_result["risk_score"] < 10:
                    return jsonify({
                        "url": url,
                        "is_phishing": heuristic_result["is_phishing"],
                        "confidence": round(heuristic_result["confidence"] * 100, 2),
                        "reasons": heuristic_result.get("reasons", []),
                        "detection_method": "heuristic_primary"
                    })
                
                # Extract full features for ML model
                ml_features = extract_ml_features(url)
                if ml_features is None:
                    return jsonify({"error": "Invalid URL"}), 400
                
                # Create DataFrame with features in correct order
                features_df = pd.DataFrame([ml_features])
                
                ml_prediction = model.predict(features_df)[0]
                ml_confidence = model.predict_proba(features_df)[0]
                
                is_phishing = bool(ml_prediction)
                confidence = float(ml_confidence[1]) if len(ml_confidence) > 1 else (ml_confidence[0] if ml_prediction else 1 - ml_confidence[0])
                
                return jsonify({
                    "url": url,
                    "is_phishing": is_phishing,
                    "confidence": round(confidence * 100, 2),
                    "reasons": heuristic_result.get("reasons", []),
                    "detection_method": "ml_model"
                })
            except Exception as ml_err:
                print(f"⚠️ ML Model error, falling back to heuristic: {ml_err}")
                result = get_url_features(url)
                if "error" in result:
                    return jsonify({"error": "Invalid URL"}), 400
                return jsonify({
                    "url": url,
                    "is_phishing": result["is_phishing"],
                    "confidence": round(result["confidence"] * 100, 2),
                    "reasons": result.get("reasons", []),
                    "detection_method": "heuristic_fallback"
                })
        else:
            # Use heuristic detector
            result = get_url_features(url)
            
            if "error" in result:
                return jsonify({"error": "Invalid URL"}), 400
            
            return jsonify({
                "url": url,
                "is_phishing": result["is_phishing"],
                "confidence": round(result["confidence"] * 100, 2),
                "reasons": result.get("reasons", []),
                "detection_method": "heuristic_only"
            })
    
    except Exception as e:
        print(f"❌ PREDICTION ERROR: {e}")
        return jsonify({"error": str(e)}), 500

# --- DATASET UPLOAD ROUTE ---
@app.route('/api/upload', methods=['POST', 'OPTIONS'])
def upload_file():
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        return '', 204
    
    print("📂 Upload request received!")
    print(f"📋 Request method: {request.method}")
    print(f"📋 Request content-type: {request.content_type}")
    print(f"📋 Request files: {list(request.files.keys())}")
    print(f"📋 Request form: {list(request.form.keys())}")
    print(f"📋 Request headers: {dict(request.headers)}")
    
    if 'file' not in request.files:
        print(f"❌ No file in request. Available keys: {list(request.files.keys())}")
        return jsonify({"error": "No file - no 'file' field in FormData"}), 400
    
    file = request.files['file']
    print(f"✅ File received: {file.filename}")
    
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
        detection_method = "heuristic_only"
        
        # Determine detection method
        if model_available:
            detection_method = "ml_model"
        
        # Process URLs in batches for better performance
        BATCH_SIZE = 50  # Process 50 URLs at a time
        for batch_start in range(0, total_rows, BATCH_SIZE):
            batch_end = min(batch_start + BATCH_SIZE, total_rows)
            batch_urls = df[url_col].iloc[batch_start:batch_end]
            
            for idx, url in enumerate(batch_urls):
                actual_idx = batch_start + idx
                try:
                    # Run lightweight pre-check (non-blocking if module absent)
                    pre = None
                    try:
                        if precheck_url:
                            pre = precheck_url(str(url))
                    except Exception as pre_err:
                        pre = {"error": f"precheck_failed: {pre_err}"}

                    # Get heuristic result first
                    heuristic_result = get_url_features(str(url))
                    
                    if "error" in heuristic_result:
                        results.append({
                            "url": str(url),
                            "is_phishing": False,
                            "confidence": 0,
                            "error": "Invalid URL",
                            "detection_method": detection_method
                        })
                        continue
                    
                    # Use ML model if available
                    if model_available:
                        try:
                            # Extract full features for model
                            ml_features = extract_ml_features(str(url))
                            if ml_features is None:
                                results.append({
                                    "url": str(url),
                                    "is_phishing": False,
                                    "confidence": 0,
                                    "error": "Could not extract features",
                                    "detection_method": "error"
                                })
                                continue
                            
                            # Create DataFrame with features
                            features_df = pd.DataFrame([ml_features])
                            
                            ml_prediction = model.predict(features_df)[0]
                            ml_confidence = model.predict_proba(features_df)[0]
                            
                            is_phishing = bool(ml_prediction)
                            confidence = float(ml_confidence[1]) if len(ml_confidence) > 1 else (ml_confidence[0] if ml_prediction else 1 - ml_confidence[0])
                            
                            if is_phishing:
                                phishing_count += 1
                            else:
                                safe_count += 1
                            
                            out = {
                                "url": str(url),
                                "is_phishing": is_phishing,
                                "confidence": round(confidence * 100, 2),
                                "reasons": heuristic_result.get("reasons", []),
                                "detection_method": "ml_model"
                            }
                            if pre is not None:
                                out["precheck"] = pre
                            results.append(out)
                        except Exception as ml_err:
                            print(f"⚠️ ML Model error at row {actual_idx}, using heuristic: {ml_err}")
                            is_phishing = heuristic_result["is_phishing"]
                            confidence = heuristic_result["confidence"]
                            
                            if is_phishing:
                                phishing_count += 1
                            else:
                                safe_count += 1
                            
                            out = {
                                "url": str(url),
                                "is_phishing": is_phishing,
                                "confidence": round(confidence * 100, 2),
                                "reasons": heuristic_result.get("reasons", []),
                                "detection_method": "heuristic_fallback"
                            }
                            if pre is not None:
                                out["precheck"] = pre
                            results.append(out)
                    else:
                        # Use heuristic detector only
                        is_phishing = heuristic_result["is_phishing"]
                        confidence = heuristic_result["confidence"]
                        
                        if is_phishing:
                            phishing_count += 1
                        else:
                            safe_count += 1
                        
                        out = {
                            "url": str(url),
                            "is_phishing": bool(is_phishing),
                            "confidence": round(confidence * 100, 2),
                            "reasons": heuristic_result.get("reasons", []),
                            "detection_method": "heuristic_only"
                        }
                        if pre is not None:
                            out["precheck"] = pre
                        results.append(out)
                    
                    # Print progress every 50 rows
                    if (actual_idx + 1) % 50 == 0:
                        print(f"✅ Processed {actual_idx + 1}/{total_rows} URLs")
                        
                except Exception as url_err:
                    print(f"⚠️ Error processing URL at row {actual_idx}: {url_err}")
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
        print(f"📊 Detection Method: {detection_method}")
        
        response_data = {
            "total": total_rows,
            "phishing_count": phishing_count,
            "safe_count": safe_count,
            "results": results,
            "from_cache": False,
            "detection_method": detection_method,
            "model_available": model_available
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