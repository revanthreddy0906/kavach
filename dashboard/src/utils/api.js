const API_BASE = 'http://localhost:8000/api';

export const fetchHeatmap = () =>
  fetch(`${API_BASE}/heatmap`).then(r => r.json());

export const fetchCascade = (zoneId) =>
  fetch(`${API_BASE}/cascade/${zoneId}`).then(r => r.json());

export const fetchPatrolPlan = (hour) =>
  fetch(`${API_BASE}/patrol-plan${hour !== undefined ? `?hour=${hour}` : ''}`).then(r => r.json());

export const fetchEnforcement = () =>
  fetch(`${API_BASE}/enforcement`).then(r => r.json());

export const fetchCounterfactual = (rate) =>
  fetch(`${API_BASE}/counterfactual?enforcement_rate=${rate}`).then(r => r.json());

export const fetchArchetypes = () =>
  fetch(`${API_BASE}/archetypes`).then(r => r.json());
