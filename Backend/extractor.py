import re
from urllib.parse import urlparse

def extract_ml_features(url):
    """
    Extract comprehensive URL features for ML model prediction.
    Returns a dictionary of 97 features expected by XGBoost model.
    """
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        directory = '/'.join(parsed.path.split('/')[:-1]).lower()
        file = parsed.path.split('/')[-1].lower() if parsed.path else ''
        params = parsed.query.lower() if parsed.query else ''
        full_url = url.lower()
    except:
        return None
    
    # Initialize features with zeros
    features = {}
    
    # URL-level features
    features['qty_dot_url'] = full_url.count('.')
    features['qty_hyphen_url'] = full_url.count('-')
    features['qty_underline_url'] = full_url.count('_')
    features['qty_slash_url'] = full_url.count('/')
    features['qty_questionmark_url'] = full_url.count('?')
    features['qty_equal_url'] = full_url.count('=')
    features['qty_at_url'] = full_url.count('@')
    features['qty_and_url'] = full_url.count('&')
    features['qty_exclamation_url'] = full_url.count('!')
    features['qty_space_url'] = full_url.count(' ')
    features['qty_tilde_url'] = full_url.count('~')
    features['qty_comma_url'] = full_url.count(',')
    features['qty_plus_url'] = full_url.count('+')
    features['qty_asterisk_url'] = full_url.count('*')
    features['qty_hashtag_url'] = full_url.count('#')
    features['qty_dollar_url'] = full_url.count('$')
    features['qty_percent_url'] = full_url.count('%')
    features['qty_tld_url'] = 1 if '.' in domain else 0
    features['length_url'] = len(full_url)
    
    # Domain-level features
    features['qty_dot_domain'] = domain.count('.')
    features['qty_hyphen_domain'] = domain.count('-')
    features['qty_underline_domain'] = domain.count('_')
    features['qty_slash_domain'] = domain.count('/')
    features['qty_questionmark_domain'] = domain.count('?')
    features['qty_equal_domain'] = domain.count('=')
    features['qty_at_domain'] = domain.count('@')
    features['qty_and_domain'] = domain.count('&')
    features['qty_exclamation_domain'] = domain.count('!')
    features['qty_space_domain'] = domain.count(' ')
    features['qty_tilde_domain'] = domain.count('~')
    features['qty_comma_domain'] = domain.count(',')
    features['qty_plus_domain'] = domain.count('+')
    features['qty_asterisk_domain'] = domain.count('*')
    features['qty_hashtag_domain'] = domain.count('#')
    features['qty_dollar_domain'] = domain.count('$')
    features['qty_percent_domain'] = domain.count('%')
    
    # Vowel count in domain
    vowels = 'aeiou'
    features['qty_vowels_domain'] = sum(1 for c in domain if c in vowels)
    features['domain_length'] = len(domain)
    
    # IP in domain check
    ip_pattern = r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}'
    features['domain_in_ip'] = 1 if re.search(ip_pattern, domain) else 0
    
    # Server/client in domain
    features['server_client_domain'] = 1 if ('server' in domain or 'client' in domain) else 0
    
    # Directory-level features
    features['qty_dot_directory'] = directory.count('.')
    features['qty_hyphen_directory'] = directory.count('-')
    features['qty_underline_directory'] = directory.count('_')
    features['qty_slash_directory'] = directory.count('/')
    features['qty_questionmark_directory'] = directory.count('?')
    features['qty_equal_directory'] = directory.count('=')
    features['qty_at_directory'] = directory.count('@')
    features['qty_and_directory'] = directory.count('&')
    features['qty_exclamation_directory'] = directory.count('!')
    features['qty_space_directory'] = directory.count(' ')
    features['qty_tilde_directory'] = directory.count('~')
    features['qty_comma_directory'] = directory.count(',')
    features['qty_plus_directory'] = directory.count('+')
    features['qty_asterisk_directory'] = directory.count('*')
    features['qty_hashtag_directory'] = directory.count('#')
    features['qty_dollar_directory'] = directory.count('$')
    features['qty_percent_directory'] = directory.count('%')
    features['directory_length'] = len(directory)
    
    # File-level features
    features['qty_dot_file'] = file.count('.')
    features['qty_hyphen_file'] = file.count('-')
    features['qty_underline_file'] = file.count('_')
    features['qty_slash_file'] = file.count('/')
    features['qty_questionmark_file'] = file.count('?')
    features['qty_equal_file'] = file.count('=')
    features['qty_at_file'] = file.count('@')
    features['qty_and_file'] = file.count('&')
    features['qty_exclamation_file'] = file.count('!')
    features['qty_space_file'] = file.count(' ')
    features['qty_tilde_file'] = file.count('~')
    features['qty_comma_file'] = file.count(',')
    features['qty_plus_file'] = file.count('+')
    features['qty_asterisk_file'] = file.count('*')
    features['qty_hashtag_file'] = file.count('#')
    features['qty_dollar_file'] = file.count('$')
    features['qty_percent_file'] = file.count('%')
    features['file_length'] = len(file)
    
    # Parameter-level features
    features['qty_dot_params'] = params.count('.')
    features['qty_hyphen_params'] = params.count('-')
    features['qty_underline_params'] = params.count('_')
    features['qty_slash_params'] = params.count('/')
    features['qty_questionmark_params'] = params.count('?')
    features['qty_equal_params'] = params.count('=')
    features['qty_at_params'] = params.count('@')
    features['qty_and_params'] = params.count('&')
    features['qty_exclamation_params'] = params.count('!')
    features['qty_space_params'] = params.count(' ')
    features['qty_tilde_params'] = params.count('~')
    features['qty_comma_params'] = params.count(',')
    features['qty_plus_params'] = params.count('+')
    features['qty_asterisk_params'] = params.count('*')
    features['qty_hashtag_params'] = params.count('#')
    features['qty_dollar_params'] = params.count('$')
    features['qty_percent_params'] = params.count('%')
    features['params_length'] = len(params)
    features['tld_present_params'] = 1 if '.' in params else 0
    features['qty_params'] = len(params.split('&')) if params else 0
    
    # Email and special features
    features['email_in_url'] = 1 if '@' in full_url else 0
    features['time_response'] = 0  # Default - not available
    features['domain_spf'] = 0  # Default - not available
    features['asn_ip'] = 0  # Default - not available
    features['time_domain_activation'] = 0  # Default - not available
    features['time_domain_expiration'] = 0  # Default - not available
    features['qty_ip_resolved'] = 0  # Default - not available
    features['qty_nameservers'] = 0  # Default - not available
    features['qty_mx_servers'] = 0  # Default - not available
    features['ttl_hostname'] = 0  # Default - not available
    features['tls_ssl_certificate'] = 0  # Default - not available
    features['qty_redirects'] = 0  # Default - not available
    features['url_google_index'] = 0  # Default - not available
    features['domain_google_index'] = 0  # Default - not available
    features['url_shortened'] = 0  # Check for URL shorteners
    
    # Detect URL shorteners
    shorteners = ['bit.ly', 'goo.gl', 't.co', 'tinyurl', 'ow.ly', 'short.link']
    if any(s in domain for s in shorteners):
        features['url_shortened'] = 1
    
    return features

def get_url_features(url):
    """
    Extract phishing detection features from URL.
    Uses heuristic rules instead of ML for accurate classification.
    """
    
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        path = parsed.path.lower()
        full_url = url.lower()
    except:
        return {"error": 1}
    
    # Phishing Risk Score (0-100, higher = more phishing)
    risk_score = 0
    reasons = []
    
    # ===== LEGITIMATE DOMAIN CHECK =====
    # Whitelist of known safe domains
    safe_domains = {
        'github.com', 'google.com', 'facebook.com', 'twitter.com', 
        'linkedin.com', 'stackoverflow.com', 'reddit.com', 'wikipedia.org',
        'youtube.com', 'amazon.com', 'ebay.com', 'paypal.com', 'microsoft.com',
        'apple.com', 'adobe.com', 'dropbox.com', 'slack.com', 'gmail.com',
        'outlook.com', 'yahoo.com', 'protonmail.com', 'github.io'
    }
    
    # Check if domain is in safe list
    is_safe = any(domain.endswith(safe) or domain == safe for safe in safe_domains)
    if is_safe:
        return {"is_phishing": False, "confidence": 0.95, "reasons": ["Verified trusted domain"]}
    
    # ===== RED FLAG CHECKS =====
    
    # 1. IP address instead of domain name
    if re.search(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', domain):
        risk_score += 30
        reasons.append("URL uses IP address instead of domain")
    
    # 2. Multiple @ symbols (credential stuffing)
    if full_url.count('@') > 1:
        risk_score += 25
        reasons.append("Multiple @ symbols (credential harvesting)")
    
    # 3. Suspicious port numbers
    if ':' in domain:
        try:
            port = int(domain.split(':')[1])
            if port not in [80, 443, 8080, 8443]:
                risk_score += 15
                reasons.append(f"Suspicious port {port}")
        except:
            pass
    
    # 4. URL shortener services
    shorteners = ['bit.ly', 'goo.gl', 't.co', 'tinyurl.com', 'ow.ly', 'short.link']
    if any(s in domain for s in shorteners):
        risk_score += 20
        reasons.append("URL shortened (obfuscation)")
    
    # 5. Typosquatting common domains
    typo_patterns = {
        'goog': 'google.com',
        'faceb': 'facebook.com',
        'tw1tt': 'twitter.com',
        'amaz0n': 'amazon.com',
        'paypa1': 'paypal.com'
    }
    for pattern, legit in typo_patterns.items():
        if pattern in domain and legit not in domain:
            risk_score += 20
            reasons.append(f"Possible typosquatting of {legit}")
    
    # 6. Suspicious keywords in URL
    suspicious_keywords = [
        'verify', 'confirm', 'update', 'urgent', 'account', 'secure',
        'login', 'signin', 'payment', 'billing', 'suspended', 'validate'
    ]
    keyword_count = sum(1 for keyword in suspicious_keywords if keyword in full_url)
    if keyword_count >= 2:
        risk_score += 15 * keyword_count
        reasons.append(f"Multiple suspicious keywords ({keyword_count})")
    
    # 7. Excessive special characters
    special_chars = len(re.findall(r'[!@#$%^&*()+=\[\]{};:\'",<>?/\\|-]', full_url))
    if special_chars > 10:
        risk_score += 15
        reasons.append("Excessive special characters")
    
    # 8. Very long URL
    if len(full_url) > 100:
        risk_score += 10
        reasons.append("Very long URL (potential obfuscation)")
    
    # 9. HTTPS is present (slightly reduces risk)
    if url.startswith('https'):
        risk_score = max(0, risk_score - 5)
    
    # 10. Multiple dots in domain (subdomain stacking)
    dot_count = domain.count('.')
    if dot_count > 3:
        risk_score += 10
        reasons.append("Excessive subdomains")
    
    # Normalize score to 0-100
    risk_score = max(0, min(100, risk_score))
    
    # Classification: > 40 is phishing
    is_phishing = risk_score > 40
    confidence = risk_score / 100.0
    
    return {
        "is_phishing": is_phishing,
        "confidence": round(confidence, 2),
        "risk_score": risk_score,
        "reasons": reasons
    }