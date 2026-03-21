// auth.js — GetOffZillow AI shared auth module
// Include on every page: <script src="auth.js"></script>
// Handles: token storage, auto-refresh, Google OAuth, session validation

const SUPABASE_URL = 'https://pneixwmkphakoxmzkblx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuZWl4d21rcGhha294bXprYmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNjE2NDAsImV4cCI6MjA4OTYzNzY0MH0.SDwzNkVCehQQqDkmj_516iFD-jphjGF1u43l19SAN_0';

window.GOZ_AUTH = {

  // ── TOKEN STORAGE ──
  getToken() { return localStorage.getItem('goz_auth_token'); },
  getRefreshToken() { return localStorage.getItem('goz_refresh_token'); },
  getAgentId() { return localStorage.getItem('goz_agent_id'); },
  getAgentName() { return localStorage.getItem('goz_agent_name'); },
  getTokenExpiry() { return parseInt(localStorage.getItem('goz_token_expiry') || '0'); },

  saveSession(data) {
    if (data.access_token) localStorage.setItem('goz_auth_token', data.access_token);
    if (data.refresh_token) localStorage.setItem('goz_refresh_token', data.refresh_token);
    if (data.expires_in) {
      const expiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer
      localStorage.setItem('goz_token_expiry', expiry.toString());
    }
  },

  clearSession() {
    ['goz_auth_token','goz_refresh_token','goz_agent_id',
     'goz_agent_name','goz_agent_email','goz_token_expiry'].forEach(k => localStorage.removeItem(k));
  },

  isLoggedIn() {
    return !!(this.getToken() && this.getAgentId());
  },

  // ── TOKEN REFRESH ──
  // Call before any authenticated API request
  async getValidToken() {
    const token = this.getToken();
    const expiry = this.getTokenExpiry();

    // If token is still valid, return it
    if (token && expiry && Date.now() < expiry) return token;

    // Try to refresh
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch('/api/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (!res.ok) {
        this.clearSession();
        return null;
      }

      const data = await res.json();
      this.saveSession(data);
      return data.access_token;

    } catch (e) {
      console.error('Token refresh failed:', e);
      return null;
    }
  },

  // ── AUTHENTICATED FETCH ──
  // Wrapper around fetch that auto-refreshes token and handles 401s
  async authFetch(url, options = {}) {
    const token = await this.getValidToken();
    if (!token) throw new Error('SESSION_EXPIRED');

    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      ...options.headers
    };

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      // Try one more refresh
      this.clearSession();
      throw new Error('SESSION_EXPIRED');
    }

    return res;
  },

  // ── SIGN IN ──
  async signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      const msg = data.error_description || data.msg || data.error || 'Login failed';
      // Make the error human-readable
      if (msg.includes('Invalid login')) throw new Error('Incorrect email or password. Please try again.');
      if (msg.includes('Email not confirmed')) throw new Error('Please confirm your email first.');
      throw new Error(msg);
    }

    this.saveSession(data);

    // Fetch agent profile
    const agentRes = await fetch(
      `${SUPABASE_URL}/rest/v1/agents?email=eq.${encodeURIComponent(email.toLowerCase())}&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${data.access_token}`
        }
      }
    );

    const agents = await agentRes.json();
    if (!agents.length) throw new Error('Agent profile not found. Please sign up first.');

    const agent = agents[0];
    localStorage.setItem('goz_agent_id', agent.id);
    localStorage.setItem('goz_agent_name', `${agent.first_name} ${agent.last_name}`);
    localStorage.setItem('goz_agent_email', agent.email);

    return agent;
  },

  // ── SIGN OUT ──
  async signOut() {
    const token = this.getToken();
    if (token) {
      // Tell Supabase to invalidate the session
      try {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (e) { /* non-fatal */ }
    }
    this.clearSession();
    window.location.href = 'dashboard.html';
  },

  // ── GOOGLE OAUTH ──
  signInWithGoogle() {
    const redirectTo = encodeURIComponent(window.location.origin + '/dashboard.html');
    window.location.href =
      `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
  },

  // ── HANDLE OAUTH CALLBACK ──
  // Call on page load — picks up the token from URL hash after Google redirect
  async handleOAuthCallback() {
    const hash = window.location.hash;
    if (!hash) return false;

    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expiresIn = params.get('expires_in');

    if (!accessToken) return false;

    // Save the session
    this.saveSession({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: parseInt(expiresIn || '3600')
    });

    // Get user info from Supabase
    try {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`
        }
      });
      const userData = await userRes.json();
      const email = userData.email;
      const fullName = userData.user_metadata?.full_name || '';
      const [firstName, ...rest] = fullName.split(' ');
      const lastName = rest.join(' ') || '';

      // Check if agent profile exists
      const agentRes = await fetch(
        `${SUPABASE_URL}/rest/v1/agents?email=eq.${encodeURIComponent(email)}&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      const agents = await agentRes.json();

      if (agents.length) {
        // Existing agent — load profile
        const agent = agents[0];
        localStorage.setItem('goz_agent_id', agent.id);
        localStorage.setItem('goz_agent_name', `${agent.first_name} ${agent.last_name}`);
        localStorage.setItem('goz_agent_email', agent.email);
      } else {
        // New OAuth user — create minimal agent profile
        const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/agents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            user_id: userData.id,
            first_name: firstName || 'Agent',
            last_name: lastName || '',
            email,
            photo_url: userData.user_metadata?.avatar_url || null
          })
        });

        const profileData = await profileRes.json();
        const agent = Array.isArray(profileData) ? profileData[0] : profileData;
        if (agent?.id) {
          localStorage.setItem('goz_agent_id', agent.id);
          localStorage.setItem('goz_agent_name', `${agent.first_name} ${agent.last_name}`);
          localStorage.setItem('goz_agent_email', email);
        }
      }

      // Clean URL
      window.history.replaceState(null, '', window.location.pathname);
      return true;

    } catch (e) {
      console.error('OAuth callback error:', e);
      return false;
    }
  },

  // ── REQUIRE AUTH ──
  // Call at top of protected pages. Redirects to dashboard if not logged in.
  async requireAuth() {
    // Check for OAuth callback first
    if (window.location.hash.includes('access_token')) {
      await this.handleOAuthCallback();
    }

    if (!this.isLoggedIn()) {
      window.location.href = 'dashboard.html';
      return false;
    }

    // Silently refresh token in background if near expiry
    this.getValidToken().catch(() => {});
    return true;
  }
};
