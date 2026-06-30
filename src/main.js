import './styles.css';
import { risks, testScenarios } from './risk-data.js';
import { buildReport, calculateScore, classifyRisk } from './readiness.js';

const storageKeys = {
  checklist: 'x-testing-checklist',
  notes: 'x-testing-notes',
  theme: 'x-testing-theme',
};

function readChecklist() {
  try {
    return JSON.parse(localStorage.getItem(storageKeys.checklist)) ?? {};
  } catch {
    return {};
  }
}

function saveChecklist(state) {
  localStorage.setItem(storageKeys.checklist, JSON.stringify(state));
}

function getInitialTheme() {
  return localStorage.getItem(storageKeys.theme) || 'light';
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(storageKeys.theme, theme);
}

function downloadReport(report) {
  const blob = new Blob([report], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'x-testing-readiness-report.txt';
  link.click();
  URL.revokeObjectURL(url);
}

function renderRiskCards(container) {
  for (const risk of risks) {
    const article = document.createElement('article');
    article.className = 'risk-card';

    const title = document.createElement('h3');
    title.textContent = risk.title;

    const level = document.createElement('span');
    level.className = `risk-level risk-${classifyRisk(risk).toLowerCase()}`;
    level.textContent = classifyRisk(risk);

    const description = document.createElement('p');
    description.textContent = risk.description;

    const mitigation = document.createElement('p');
    mitigation.className = 'mitigation';
    mitigation.textContent = `Mitigation: ${risk.mitigation}`;

    article.append(title, level, description, mitigation);
    container.append(article);
  }
}

function renderChecklist(container, savedState, onChange) {
  for (const scenario of testScenarios) {
    const label = document.createElement('label');
    label.className = 'scenario';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(savedState[scenario.id]);
    checkbox.dataset.scenarioId = scenario.id;
    checkbox.addEventListener('change', onChange);

    const content = document.createElement('span');
    content.textContent = scenario.label;

    const badge = document.createElement('small');
    badge.textContent = scenario.category;

    label.append(checkbox, content, badge);
    container.append(label);
  }
}

export function mountApp(root) {
  const checklistState = readChecklist();
  setTheme(getInitialTheme());

  root.innerHTML = `
    <section class="hero" aria-labelledby="page-title">
      <div>
        <p class="eyebrow">Quality, security, and release readiness</p>
        <h1 id="page-title">X Testing Dashboard</h1>
        <p class="hero-copy">Plan end-to-end coverage, review security risks, track readiness, and export a concise release report.</p>
      </div>
      <button class="secondary" id="theme-toggle" type="button">Toggle theme</button>
    </section>

    <section class="grid" aria-label="Readiness summary">
      <article class="metric">
        <span id="score-value">0%</span>
        <p>Readiness score</p>
      </article>
      <article class="metric">
        <span>${testScenarios.length}</span>
        <p>E2E scenarios</p>
      </article>
      <article class="metric">
        <span>${risks.length}</span>
        <p>Security risks tracked</p>
      </article>
    </section>

    <section class="panel" aria-labelledby="checklist-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Interactive checklist</p>
          <h2 id="checklist-title">End-to-end testing coverage</h2>
        </div>
        <button id="reset-checklist" type="button">Reset</button>
      </div>
      <div class="scenario-list" id="scenario-list"></div>
    </section>

    <section class="panel" aria-labelledby="risk-title">
      <p class="eyebrow">Security analysis</p>
      <h2 id="risk-title">Risk register</h2>
      <div class="risk-grid" id="risk-grid"></div>
    </section>

    <section class="panel" aria-labelledby="notes-title">
      <p class="eyebrow">Release notes</p>
      <h2 id="notes-title">Analyst notes and report</h2>
      <textarea id="notes" rows="5" maxlength="800" placeholder="Add release risks, testing gaps, or acceptance notes..."></textarea>
      <div class="actions">
        <button id="generate-report" type="button">Generate report</button>
        <button class="secondary" id="download-report" type="button">Download report</button>
      </div>
      <pre id="report-output" aria-live="polite"></pre>
    </section>
  `;

  const scenarioList = root.querySelector('#scenario-list');
  const riskGrid = root.querySelector('#risk-grid');
  const scoreValue = root.querySelector('#score-value');
  const notes = root.querySelector('#notes');
  const reportOutput = root.querySelector('#report-output');

  notes.value = localStorage.getItem(storageKeys.notes) || '';

  const getScenarioItems = () =>
    testScenarios.map((scenario) => ({ id: scenario.id, done: Boolean(checklistState[scenario.id]) }));

  const refreshScore = () => {
    scoreValue.textContent = `${calculateScore(getScenarioItems())}%`;
  };

  const createReport = () => {
    const score = calculateScore(getScenarioItems());
    return buildReport({
      score,
      notes: notes.value.trim(),
      completedScenarios: getScenarioItems().filter((item) => item.done).length,
    });
  };

  renderChecklist(scenarioList, checklistState, (event) => {
    checklistState[event.target.dataset.scenarioId] = event.target.checked;
    saveChecklist(checklistState);
    refreshScore();
  });
  renderRiskCards(riskGrid);
  refreshScore();

  notes.addEventListener('input', () => {
    localStorage.setItem(storageKeys.notes, notes.value);
  });

  root.querySelector('#reset-checklist').addEventListener('click', () => {
    for (const checkbox of scenarioList.querySelectorAll('input[type="checkbox"]')) {
      checkbox.checked = false;
      checklistState[checkbox.dataset.scenarioId] = false;
    }
    saveChecklist(checklistState);
    refreshScore();
  });

  root.querySelector('#generate-report').addEventListener('click', () => {
    reportOutput.textContent = createReport();
  });

  root.querySelector('#download-report').addEventListener('click', () => {
    downloadReport(createReport());
  });

  root.querySelector('#theme-toggle').addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
}

mountApp(document.querySelector('#app'));
