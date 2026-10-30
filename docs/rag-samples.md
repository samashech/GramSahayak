# RAG samples (RAG-08) — G1 in Hindi, Marathi, Tamil

Real `POST /rag/query` calls against the RAG service on 2026-10-30 23:51 UTC (`/health`: status=ok, vectors=45, mode=extractive). This is exactly what the Node gateway sends (contract section 9) and receives. Node then replaces any SMS text with the seed card `sms_summary` (R5).

## G1 · hi-IN

Request:
```json
{
  "query": "पीएम किसान योजना के लिए कौन पात्र है?",
  "language": "hi-IN",
  "category": "schemes",
  "role": "farmer",
  "for_voice": true,
  "history": []
}
```

Response:
```json
{
  "answer": "प्रधानमंत्री किसान सम्मान निधि: पीएम-किसान: भूमिधारक किसान परिवार को ₹6000/वर्ष, 3 किस्तों में, दस्तावेज़: आधार, भूमि रिकॉर्ड, बैंक खाता, eKYC, pmkisan, gov, in हेल्पलाइन: 155261. पूरी जानकारी एसएमएस द्वारा भेजी जा रही है।",
  "sources": [
    {
      "id": "PMKISAN",
      "title": "PM-KISAN Samman Nidhi",
      "category": "schemes",
      "helpline": "155261",
      "portal": "https://pmkisan.gov.in"
    },
    {
      "id": "PMAY",
      "title": "Pradhan Mantri Awas Yojana - Gramin",
      "category": "schemes",
      "helpline": "1800-11-6446",
      "portal": "https://pmayg.nic.in"
    },
    {
      "id": "UJJWALA",
      "title": "Pradhan Mantri Ujjwala Yojana (PMUY)",
      "category": "schemes",
      "helpline": "1800-233-3555",
      "portal": "https://www.pmuy.gov.in"
    }
  ],
  "matched_scheme_id": "PMKISAN",
  "sms_summary": "पीएम-किसान: भूमिधारक किसान परिवार को ₹6000/वर्ष, 3 किस्तों में। दस्तावेज़: आधार, भूमि रिकॉर्ड, बैंक खाता, eKYC। pmkisan.gov.in हेल्पलाइन: 155261",
  "confidence": 0.8321,
  "mode": "extractive",
  "latency_ms": 37
}
```

## G1 · mr-IN

Request:
```json
{
  "query": "पीएम किसान योजनेसाठी कोण पात्र आहे?",
  "language": "mr-IN",
  "category": "schemes",
  "role": "farmer",
  "for_voice": true,
  "history": []
}
```

Response:
```json
{
  "answer": "प्रधानमंत्री किसान सन्मान निधी: पीएम-किसान: जमीनधारक शेतकरी कुटुंबाला ₹6000/वर्ष, 3 हप्त्यांत, कागदपत्रे: आधार, सातबारा, बँक खाते, eKYC, pmkisan, gov, in हेल्पलाइन: 155261. सविस्तर माहिती एसएमएसद्वारे पाठवली जात आहे.",
  "sources": [
    {
      "id": "PMKISAN",
      "title": "PM-KISAN Samman Nidhi",
      "category": "schemes",
      "helpline": "155261",
      "portal": "https://pmkisan.gov.in"
    },
    {
      "id": "PMAY",
      "title": "Pradhan Mantri Awas Yojana - Gramin",
      "category": "schemes",
      "helpline": "1800-11-6446",
      "portal": "https://pmayg.nic.in"
    },
    {
      "id": "UJJWALA",
      "title": "Pradhan Mantri Ujjwala Yojana (PMUY)",
      "category": "schemes",
      "helpline": "1800-233-3555",
      "portal": "https://www.pmuy.gov.in"
    }
  ],
  "matched_scheme_id": "PMKISAN",
  "sms_summary": "पीएम-किसान: जमीनधारक शेतकरी कुटुंबाला ₹6000/वर्ष, 3 हप्त्यांत. कागदपत्रे: आधार, सातबारा, बँक खाते, eKYC. pmkisan.gov.in हेल्पलाइन: 155261",
  "confidence": 0.8453,
  "mode": "extractive",
  "latency_ms": 19
}
```

## G1 · ta-IN

Request:
```json
{
  "query": "பிஎம் கிசான் திட்டத்திற்கு யார் தகுதியானவர்?",
  "language": "ta-IN",
  "category": "schemes",
  "role": "farmer",
  "for_voice": true,
  "history": []
}
```

Response:
```json
{
  "answer": "பிரதமர் கிசான் சம்மான் நிதி: பிஎம்-கிசான்: நில உரிமை விவசாய குடும்பத்திற்கு ஆண்டுக்கு ₹6000, 3 தவணைகளில், ஆவணங்கள்: ஆதார், நில பதிவு, வங்கி கணக்கு, pmkisan, gov, in உதவி: 155261. முழு விவரங்கள் எஸ்எம்எஸ் மூலம் அனுப்பப்படுகின்றன.",
  "sources": [
    {
      "id": "PMKISAN",
      "title": "PM-KISAN Samman Nidhi",
      "category": "schemes",
      "helpline": "155261",
      "portal": "https://pmkisan.gov.in"
    },
    {
      "id": "PMAY",
      "title": "Pradhan Mantri Awas Yojana - Gramin",
      "category": "schemes",
      "helpline": "1800-11-6446",
      "portal": "https://pmayg.nic.in"
    },
    {
      "id": "UJJWALA",
      "title": "Pradhan Mantri Ujjwala Yojana (PMUY)",
      "category": "schemes",
      "helpline": "1800-233-3555",
      "portal": "https://www.pmuy.gov.in"
    }
  ],
  "matched_scheme_id": "PMKISAN",
  "sms_summary": "பிஎம்-கிசான்: நில உரிமை விவசாய குடும்பத்திற்கு ஆண்டுக்கு ₹6000, 3 தவணைகளில். ஆவணங்கள்: ஆதார், நில பதிவு, வங்கி கணக்கு. pmkisan.gov.in உதவி: 155261",
  "confidence": 0.8188,
  "mode": "extractive",
  "latency_ms": 23
}
```

Cross-lingual check (`rag/eval/run_eval.py` section 2): PMKISAN and JSY match in hi/mr/ta/en.
