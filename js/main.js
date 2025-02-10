// main.js
const scriptTag = document.currentScript;

let questions = [];
let imagesPerQuestion = {};
let currentQuestionIndex = 0; // Track which question is currently displayed
let docMapping = {}; // doc_id -> "filename-page" mapping

// Store user answers: { [question_id]: { [doc_id]: "Yes"|"No"|null }, ... }
let userAnswers = {};
// Store user comments: { [question_id]: { [doc_id]: "some comment" }, ... }
let userComments = {};

document.addEventListener('DOMContentLoaded', async () => {
  const qrelFile = scriptTag.dataset.qrel;
  const topicsFile = scriptTag.dataset.topics; // Now this is a JSON file
  const mappingFile = scriptTag.dataset.mapping;
  const pdfDir = scriptTag.dataset.pdfdir;

  // Get Progress Bar
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');

  // Disable submit button initially
  const submitButton = document.getElementById('submit-button');
  submitButton.disabled = true;

  // Load questions from JSON file
  questions = await loadQuestionsFromJsonFile(topicsFile);
  console.log('Total questions: ' + questions.length);
  imagesPerQuestion = await loadImagesPerQuestionFromQrel(qrelFile);
  docMapping = await loadMapping(mappingFile);

  // Filter questions to display only those that have doc_ids in the QREL
  questions = questions.filter(
    (q) => imagesPerQuestion[q.question_id] && imagesPerQuestion[q.question_id].length > 0
  );
  console.log('Total questions (after QREL filter): ' + questions.length);

  const mainContainer = document.getElementById('question-container');

  // Modified renderPage function to accept a pre-loaded pdf document
  async function renderPage(pdf, pageNumber, docCanvas, scale, rotation = 0) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: scale, rotation: rotation });
    const context = docCanvas.getContext('2d');
    docCanvas.height = viewport.height;
    docCanvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
  }

  // Restore stored progress if available
  const storedAnswers = localStorage.getItem('judgingProgress');
  if (storedAnswers) {
    userAnswers = JSON.parse(storedAnswers);
  }
  const storedComments = localStorage.getItem('judgingComments');
  if (storedComments) {
    userComments = JSON.parse(storedComments);
  }
  const storedIndex = localStorage.getItem('currentQuestionIndex');
  if (storedIndex) {
    currentQuestionIndex = parseInt(storedIndex, 10) || 0;
  }

  // Render all questions
  for (let index = 0; index < questions.length; index++) {
    const q = questions[index];
    const qBlock = document.createElement('div');
    qBlock.className = 'question-block';
    qBlock.id = 'question-block-' + index;
    if (index !== currentQuestionIndex) {
      qBlock.style.display = 'none'; // Hide all but the current saved question
    }

    const docIds = imagesPerQuestion[q.question_id] || [];
    let sampleId = 1;
    for (const doc_id of docIds) {
      const docBlock = document.createElement('div');
      docBlock.className = 'doc-block';

      // Insert the question text here
      const qTextForDoc = document.createElement('div');
      qTextForDoc.className = 'question-text';
      qTextForDoc.textContent = `${index + 1}. ${q.text}`;
      docBlock.appendChild(qTextForDoc);

      // Now continue as usual
      const docInfo = docMapping[doc_id];
      if (docInfo) {
        const lastDashIndex = docInfo.lastIndexOf('-');
        const filename = docInfo.substring(0, lastDashIndex);
        let pageNumber = parseInt(docInfo.substring(lastDashIndex + 1), 10);

        const pdfUrl = `${pdfDir}/${filename}`;

        // Default scale
        let currentScale = 3.0;
        // Default rotation
        let currentRotation = 0; // in degrees, can be 0, 90, 180, 270

        // Create a clickable header (anchor) for the doc block
        const docHeader = document.createElement('div');
        docHeader.className = 'doc-header';

        const docLink = document.createElement('a');
        docLink.href = `${pdfUrl}#page=${pageNumber}`; // open PDF to specific page
        docLink.target = '_blank';                     // open in a new tab
        docLink.download = `${filename}`;              // fallback: if not viewable, will download
        docLink.textContent = `${filename}`;

        docHeader.appendChild(docLink);
        docBlock.appendChild(docHeader);

        // Page navigation controls
        const zoomContainer = document.createElement('div');
        zoomContainer.className = 'zoom-controls';

        const prevPageBtn = document.createElement('button');
        prevPageBtn.textContent = '<';
        prevPageBtn.title = 'Previous Page';

        const pageNumberSpan = document.createElement('span');
        pageNumberSpan.style.margin = '0 10px';
        pageNumberSpan.textContent = `Page ${pageNumber}`;

        const nextPageBtn = document.createElement('button');
        nextPageBtn.textContent = '>';
        nextPageBtn.title = 'Next Page';

        const rotateBtn = document.createElement('button');
        rotateBtn.textContent = '↻';
        rotateBtn.title = 'Rotate 90°';

        // Attach event listeners for page navigation
        prevPageBtn.addEventListener('click', async () => {
          if (pdf && pageNumber > 1) {
            pageNumber--;
            await renderPage(pdf, pageNumber, docCanvas, currentScale, currentRotation);
            pageNumberSpan.textContent = `Page ${pageNumber}`;
          }
        });

        nextPageBtn.addEventListener('click', async () => {
          if (pdf && pageNumber < pdf.numPages) {
            pageNumber++;
            await renderPage(pdf, pageNumber, docCanvas, currentScale, currentRotation);
            pageNumberSpan.textContent = `Page ${pageNumber}`;
          }
        });

        rotateBtn.addEventListener('click', async () => {
          if (pdf) {
            currentRotation = (currentRotation + 90) % 360;
            await renderPage(pdf, pageNumber, docCanvas, currentScale, currentRotation);
          }
        });

        // Append navigation elements in the new order
        zoomContainer.appendChild(prevPageBtn);
        zoomContainer.appendChild(pageNumberSpan);
        zoomContainer.appendChild(nextPageBtn);
        zoomContainer.appendChild(rotateBtn);

        // Append navigation above relevance
        docBlock.appendChild(zoomContainer);

        // "Relevant Page?" label and radio buttons container
        const correctPageContainer = document.createElement('div');
        correctPageContainer.className = 'correct-page-container';

        const labelYes = document.createElement('label');
        labelYes.textContent = 'Relevant Page? Yes ';

        const radioYes = document.createElement('input');
        radioYes.type = 'radio';
        radioYes.name = q.question_id + '_' + doc_id;
        radioYes.value = 'Yes';
        radioYes.id = q.question_id + '_' + doc_id + '_yes';

        const labelNo = document.createElement('label');
        labelNo.textContent = ' No ';

        const radioNo = document.createElement('input');
        radioNo.type = 'radio';
        radioNo.name = q.question_id + '_' + doc_id;
        radioNo.value = 'No';
        radioNo.id = q.question_id + '_' + doc_id + '_no';

        // COMMENT TEXTBOX
        const commentBox = document.createElement('input');
        commentBox.type = 'text';
        commentBox.placeholder = 'Optional comment ...';
        commentBox.id = q.question_id + '_' + doc_id + '_comment';
        // Make it a bit wider
        commentBox.style.width = '300px';

        // Append them in order
        correctPageContainer.appendChild(labelYes);
        correctPageContainer.appendChild(radioYes);
        correctPageContainer.appendChild(labelNo);
        correctPageContainer.appendChild(radioNo);
        correctPageContainer.appendChild(commentBox);

        docBlock.appendChild(correctPageContainer);

        // Create the canvas
        const docCanvas = document.createElement('canvas');
        docCanvas.className = 'pdf-canvas';
        docBlock.appendChild(docCanvas);

        // Load PDF
        let pdf = null;
        getCachedPdf(pdfUrl)
          .then((loadedPdf) => {
            pdf = loadedPdf;
            return renderPage(pdf, pageNumber, docCanvas, currentScale, currentRotation);
          })
          .then(() => {
            pageNumberSpan.textContent = `Page ${pageNumber}`;
          })
          .catch((error) => {
            console.error('Error rendering PDF page:', error);
            const noData = document.createElement('div');
            noData.textContent = 'Error loading PDF page for ' + doc_id;
            docBlock.appendChild(noData);
          });

        const separator = document.createElement('hr');
        separator.className = 'page-separator';
        docBlock.appendChild(separator);
        qBlock.appendChild(docBlock);

        sampleId++;
      }
    }

    mainContainer.appendChild(qBlock);
  }

  // Show the question index
  function showQuestion(index) {
    questions.forEach((_, i) => {
      const block = document.getElementById('question-block-' + i);
      block.style.display = i === index ? 'block' : 'none';
    });

    document.getElementById('prev-button').disabled = index === 0;
    document.getElementById('next-button').disabled = index === questions.length - 1;

    const currentQuestionBlock = document.getElementById('question-block-' + index);
    const firstDocBlock = currentQuestionBlock.querySelector('.doc-block');

    if (firstDocBlock) {
      firstDocBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      currentQuestionBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Save current index in localStorage
    localStorage.setItem('currentQuestionIndex', index);

    // If this is the last question, check if it's fully answered
    if (index === questions.length - 1) {
      submitButton.disabled = !isLastQuestionFullyAnswered();
    } else {
      submitButton.disabled = true; // Not on the last question
    }

    // Update progress bar
    progressBar.max = questions.length;
    progressBar.value = index + 1;
    progressText.textContent = `Question ${index + 1} of ${questions.length}`;
  }

  function isQuestionFullyAnswered(questionIndex) {
    const q = questions[questionIndex];
    const docIds = imagesPerQuestion[q.question_id] || [];
    return docIds.every((doc_id) => {
      return (
        userAnswers[q.question_id] &&
        (userAnswers[q.question_id][doc_id] === 'Yes' ||
          userAnswers[q.question_id][doc_id] === 'No')
      );
    });
  }

  function findUnansweredPairs() {
    const unanswered = [];
    questions.forEach((q, qIndex) => {
      const docIds = imagesPerQuestion[q.question_id] || [];
      docIds.forEach((doc_id) => {
        const answer =
          userAnswers[q.question_id] && userAnswers[q.question_id][doc_id];
        if (answer !== 'Yes' && answer !== 'No') {
          // This doc_id for this q.question_id is unanswered
          unanswered.push({ qIndex, qid: q.question_id, docid: doc_id });
        }
      });
    });
    return unanswered;
  }

  function jumpToFirstUnanswered() {
    const unanswered = findUnansweredPairs();
    if (unanswered.length === 0) {
      alert('All questions are answered!');
      return;
    }

    // Jump to the first one
    const first = unanswered[0];
    // Change the current question index so that question is visible
    currentQuestionIndex = first.qIndex;
    showQuestion(currentQuestionIndex);

    // Now highlight the doc-block
    highlightDocBlock(first.qid, first.docid);
  }

  // A helper to visually highlight the doc-block (e.g. red border)
  function highlightDocBlock(qid, docid) {
    // The doc-block is the parent of the radio buttons for (qid, docid)
    const docBlock = document.querySelector(
      `#question-block-${currentQuestionIndex} .doc-block [id='${qid}_${docid}_yes']`
    )?.closest('.doc-block');

    if (docBlock) {
      docBlock.style.border = '3px solid red';
      // Scroll into view so the user can see it
      docBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Optionally remove the highlight after a few seconds
      setTimeout(() => {
        docBlock.style.border = '';
      }, 3000);
    }
  }

  // Previous / Next /Incomplete button listeners
  document.getElementById('prev-button').addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
      currentQuestionIndex--;
      showQuestion(currentQuestionIndex);
    }
  });
  document.getElementById('next-button').addEventListener('click', () => {
    if (currentQuestionIndex < questions.length - 1) {
      currentQuestionIndex++;
      showQuestion(currentQuestionIndex);
    }
  });
  document.getElementById('check-incomplete-button').addEventListener('click', () => {
    jumpToFirstUnanswered();
  });

  // SUBMIT
  document.getElementById('submit-button').addEventListener('click', () => {
    // Build QREL file (qrels.txt)
    let qrelStr = '';
    questions.forEach((q) => {
      const docIds = imagesPerQuestion[q.question_id] || [];
      docIds.forEach((doc_id) => {
        let relevance = 0;
        if (
          userAnswers[q.question_id] &&
          userAnswers[q.question_id][doc_id] === 'Yes'
        ) {
          relevance = 1;
        }

        // Grab the comment text (if any)
        const commentText =
          userComments[q.question_id] && userComments[q.question_id][doc_id]
            ? userComments[q.question_id][doc_id]
            : '';

        // Now each line has the format:
        // qid 0 docid relevance comment
        qrelStr += `${q.question_id} 0 ${doc_id} ${relevance} ${commentText}\n`;
      });
    });

    // Download QREL (with comments included)
    downloadFile(qrelStr, 'qrels.txt');

    // Clear localStorage
    localStorage.removeItem('judgingProgress');
    localStorage.removeItem('judgingComments');
    localStorage.removeItem('currentQuestionIndex');

    // Also clear in-memory data
    userAnswers = {};
    userComments = {};
    currentQuestionIndex = 0;

    // Reload the page completely:
    location.reload();

    // Display a message
    alert('Thank you for your submission! Your responses have been reset.');
  });

  // After the DOM is ready and all nodes are created, restore the checked states and comment box text
  restoreCheckedStates();
  restoreComments();

  // Listen to changes on radio buttons to update userAnswers and localStorage
  document.addEventListener('change', (e) => {
    // Radio button changed
    if (e.target.type === 'radio') {
      const nameParts = e.target.name.split('_');
      const qid = nameParts[0];
      const docid = nameParts[1];

      if (!userAnswers[qid]) userAnswers[qid] = {};
      userAnswers[qid][docid] = e.target.value;
      localStorage.setItem('judgingProgress', JSON.stringify(userAnswers));

      // If user clicks "Yes" -> auto-scroll to the next doc-block
      // If user clicks "No" -> focus on the Comment box
      const docBlock = e.target.closest('.doc-block');

      if (e.target.value === 'Yes') {
        // Move to next doc-block or next question
        let nextDocBlock = docBlock.nextElementSibling;
        // Skip any non doc-block elements
        while (nextDocBlock && !nextDocBlock.classList.contains('doc-block')) {
          nextDocBlock = nextDocBlock.nextElementSibling;
        }

        if (nextDocBlock) {
          nextDocBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          // No more doc-blocks in this question, move to next question if available
          if (currentQuestionIndex < questions.length - 1) {
            currentQuestionIndex++;
            showQuestion(currentQuestionIndex);
          } else {
            // Last question and last doc-block, optionally scroll to submit
            // document.getElementById('submit-button').scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      } else if (e.target.value === 'No') {
        // Focus on the comment box
        const commentBox = docBlock.querySelector(
          '#' + qid + '_' + docid + '_comment'
        );
        if (commentBox) {
          commentBox.focus();
        }
      }

      // If on last question, check completion
      if (currentQuestionIndex === questions.length - 1) {
        submitButton.disabled = !isLastQuestionFullyAnswered();
      }
    }
    // Text box changed
    if (e.target.type === 'text') {
      const idParts = e.target.id.split('_'); // qid_docid_comment
      const qid = idParts[0];
      const docid = idParts[1];
      const commentValue = e.target.value;

      if (!userComments[qid]) userComments[qid] = {};
      userComments[qid][docid] = commentValue;
      localStorage.setItem('judgingComments', JSON.stringify(userComments));
    }
  });

  // Show the current question (which might have been restored)
  showQuestion(currentQuestionIndex);
});

// A dictionary to cache loaded PDFs so we don't load the same URL multiple times.
const pdfCache = {}; // { [pdfUrl]: Promise<PDFDocumentProxy> }

function getCachedPdf(pdfUrl) {
  if (!pdfCache[pdfUrl]) {
    // Cache the PDF promise the first time it's requested
    pdfCache[pdfUrl] = pdfjsLib.getDocument(pdfUrl).promise;
  }
  return pdfCache[pdfUrl];
}

// Helper to load doc mapping
async function loadMapping(mappingFile) {
  const response = await fetch(mappingFile);
  const data = await response.json();
  return data;
}

// Helper to load images per question from QREL
async function loadImagesPerQuestionFromQrel(qrelFile) {
  const response = await fetch(qrelFile);
  const text = await response.text();
  const lines = text.trim().split(/\r?\n/);
  const imagesPerQuestion = {};

  for (const line of lines) {
    if (line.trim() === '') continue;
    const parts = line.split(/\s+/);
    if (parts.length < 4) continue;
    const qid = parts[0];
    const docid = parts[2];

    if (!imagesPerQuestion[qid]) {
      imagesPerQuestion[qid] = [];
    }
    if (!imagesPerQuestion[qid].includes(docid)) {
      imagesPerQuestion[qid].push(docid);
    }
  }

  return imagesPerQuestion;
}

// Helper to load questions from JSON
async function loadQuestionsFromJsonFile(topicsFile) {
  const response = await fetch(topicsFile);
  const data = await response.json();

  // data is of the form { "question_id": "question text", ... }
  // We'll parse out the bracketed group (if present).
  const questions = Object.entries(data).map(([question_id, text]) => {
    // Use a regex to grab the text in [square brackets], if any
    const match = text.match(/\[(.*?)\]/);
    const group = match ? match[1] : '';  // e.g. "APV 993 (LINE01-PROF01)"
    return { question_id, text, group };
  });

  // Now sort by the group name to keep all identical groups together
  // (localeCompare ensures alphabetical sorting)
  questions.sort((a, b) => a.group.localeCompare(b.group));

  return questions;
}

// Restore the checked states from userAnswers
function restoreCheckedStates() {
  for (let qid in userAnswers) {
    for (let docid in userAnswers[qid]) {
      const value = userAnswers[qid][docid];
      const yesRadio = document.getElementById(qid + '_' + docid + '_yes');
      const noRadio = document.getElementById(qid + '_' + docid + '_no');
      if (value === 'Yes' && yesRadio) yesRadio.checked = true;
      if (value === 'No' && noRadio) noRadio.checked = true;
    }
  }
}

// Restore the comment text from userComments
function restoreComments() {
  for (let qid in userComments) {
    for (let docid in userComments[qid]) {
      const commentValue = userComments[qid][docid];
      const commentBox = document.getElementById(
        qid + '_' + docid + '_comment'
      );
      if (commentBox) {
        commentBox.value = commentValue;
      }
    }
  }
}

// Check if last question is fully answered
function isLastQuestionFullyAnswered() {
  const lastQuestionIndex = questions.length - 1;
  const lastQuestion = questions[lastQuestionIndex];
  const docIds = imagesPerQuestion[lastQuestion.question_id] || [];

  // Check if each doc_id in the last question has a "Yes" or "No" answer.
  for (const doc_id of docIds) {
    if (
      !userAnswers[lastQuestion.question_id] ||
      (userAnswers[lastQuestion.question_id][doc_id] !== 'Yes' &&
        userAnswers[lastQuestion.question_id][doc_id] !== 'No')
    ) {
      return false;
    }
  }
  return true;
}

// Utility to initiate file download from a string
function downloadFile(contentStr, filename) {
  const blob = new Blob([contentStr], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}