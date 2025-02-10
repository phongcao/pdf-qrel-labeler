# pdf-qrel-labeler 🏷️📄

A lightweight web-based tool for ground truth labeling of PDF documents. It presents questions
and multiple answer candidates (PDF pages) for subject matter experts (SMEs) to review.
Each question-answer pair is hashed and stored in a
[TREC QREL](https://ir-kit.readthedocs.io/en/latest/trec.html) file to support relevance
assessment.
Built using **HTML, JavaScript, PDF.js**, and static web technologies for easy deployment.

🚀 **Features**:

* Renders PDF pages using **PDF.js** for annotation and review
* Supports **one question/multiple relevant answers** format
* Stores results in **TREC QREL** format for evaluation
* Fully **static**, easy to host and share

🔧 Ideal for **information retrieval, NLP, and machine learning dataset creation**.

## Generating Document and Query Mapping Files

To generate the document and query mapping files, use the Jupyter notebook located at:

```
notebook/generate_mappings.ipynb
```

**Data Sources**:

* **PDF Files**: Loaded from the `pdf` folder.
* **Queries**: Loaded from the `queries.csv` file.

The notebook processes these inputs and generates four mapping files:

* `data/query_mapping.json`
* `data/reverse_query_mapping.json`
* `data/doc_mapping.json`
* `data/reverse_doc_mapping.json`

## Launching the Tool

Follow these steps to launch the tool:

1. Start a local server in the project directory by running:

```bash
python -m http.server 8000
```

2. Open a web browser and navigate to:

```
http://localhost:8000
```
