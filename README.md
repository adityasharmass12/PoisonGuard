# Poisoned Dataset Detection System

## Overview
The Poisoned Dataset Detection System is an AI-driven solution designed to detect and eliminate malicious or manipulated data samples before they are used in machine learning model training. The system enhances data integrity, improves model reliability, and reduces vulnerabilities caused by data poisoning attacks.

This project introduces a pre-training validation pipeline that ensures only clean and trustworthy data is used for building machine learning models.

---

## Problem Statement
Machine learning models are highly dependent on the quality of training data. If datasets contain poisoned or adversarial samples, it can lead to incorrect predictions, biased outputs, and potential system failures.

Existing approaches focus primarily on improving model performance but often overlook the integrity of the input data. This project addresses that gap by introducing a system that analyzes and cleans datasets before training.

---

## Proposed Solution
The system implements a multi-layer detection pipeline that scans datasets and identifies suspicious or anomalous data points using machine learning techniques.

Key functionalities include:
- Automated dataset scanning before model training
- Detection of anomalies using statistical and machine learning methods
- Identification and isolation of suspicious samples
- Generation of a clean dataset for safe training
- Confidence-based scoring for detected anomalies

---

## System Architecture

User uploads dataset  
→ Frontend (React Interface)  
→ Backend API (FastAPI)  
→ Data Preprocessing  
→ Multi-layer Detection Engine  
→ Result Generation (Clean + Suspicious Data)  
→ Frontend Dashboard Visualization  

---

## Technical Approach

The system uses a combination of multiple techniques to ensure robust anomaly detection:

### Statistical Analysis
Analyzes data distribution, mean, variance, and deviations to identify irregular patterns.

### Clustering-Based Detection
Uses clustering algorithms such as DBSCAN to group similar data points and detect outliers.

### Isolation Forest
An unsupervised anomaly detection algorithm that isolates anomalies instead of profiling normal data, making it efficient for large datasets.

### Model Behavior Analysis
Evaluates the impact of individual data points on model predictions to detect potentially harmful samples.

---

## Features
- Multi-layer anomaly detection system  
- Support for tabular, image, and text datasets  
- Confidence-based anomaly scoring  
- Interactive dashboard for visualization  
- Clean dataset export functionality  
- Scalable and modular architecture  

---

## Tech Stack
Frontend: React, Tailwind CSS, Framer Motion  
Backend: FastAPI  
Machine Learning: Scikit-learn, PyTorch  
Deployment: Docker  

---

## Project Structure

project-root/  
│  
├── frontend/  
│   ├── src/  
│   ├── components/  
│   └── App.jsx  
│  
├── backend/  
│   ├── main.py  
│   ├── model_loader.py  
│   ├── utils.py  
│   └── model.pkl  
│  
├── data/  
├── requirements.txt  
└── README.md  

---

## Installation

### Clone the Repository
```bash
git clone https://github.com/adityasharmass12/PoisonGuard.git
```

### Backend Setup
cd backend
pip install -r requirements.txt  
uvicorn main:app --reload  

### Frontend Setup
cd frontend  
npm install  
npm run dev  

---

## API Endpoint

POST /analyze/  
Uploads dataset and performs anomaly detection.

---

## Usage
1. Upload dataset through the frontend interface  
2. The backend processes the dataset using the detection pipeline  
3. View summary including total, clean, and suspicious samples  
4. Analyze flagged anomalies in the dashboard  
5. Download the cleaned dataset for further use  

---

## Results
The system successfully identifies anomalous and suspicious data points in datasets and separates them from clean data. This ensures improved data quality and more reliable machine learning model training.

---

## Applications
- Healthcare AI systems  
- Financial fraud detection  
- Autonomous systems  
- Cybersecurity pipelines  
- Government and defense AI applications  

---

## Future Scope
- Integration of deep learning models such as Autoencoders  
- Real-time dataset monitoring and streaming analysis  
- Advanced visualization dashboards  
- User authentication and access control  
- Integration as a plugin in ML pipelines  

---

## Limitations
- Performance depends on dataset quality and feature representation  
- Highly sophisticated poisoning attacks may require advanced models  
- Requires proper preprocessing for optimal results  

---

## Conclusion
The Poisoned Dataset Detection System provides a reliable and scalable approach to securing machine learning pipelines by ensuring that only clean and trustworthy data is used for training. It addresses a critical yet often overlooked aspect of AI systems — data integrity.

---

## Team Details
Team Name: TEAM LUMEN  

Members:  
Aditya Sharma  
Harshit  
Rohit  

---

## License
This project is developed for academic, research, and hackathon purposes.