const API_BASE = 'http://localhost:3000/api';

async function apiFetch(endpoint, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        if (res.status === 404) return [];
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Server error');
        }
        return await res.json();
    } catch (err) {
        console.error(`API Error [${endpoint}]:`, err.message);
        throw err;
    }
}



const api = {
    get:    (endpoint)         => apiFetch(endpoint),
    post:   (endpoint, data)   => apiFetch(endpoint, { method: 'POST',   body: JSON.stringify(data) }),
    put:    (endpoint, data)   => apiFetch(endpoint, { method: 'PUT',    body: JSON.stringify(data) }),
    delete: (url, body = {}) => apiFetch(url, {
       method: 'DELETE',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(body)
})};

