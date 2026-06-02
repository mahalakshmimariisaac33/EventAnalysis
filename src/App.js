import { useState } from 'react';
import DecorGallery from './components/DecorGallery';

function App() {
  const [activeTab, setActiveTab] = useState('decor');

  return (
    <div style={styles.app}>
      <nav style={styles.nav}>
        <button
          style={{ ...styles.navBtn, ...(activeTab === 'decor' ? styles.navBtnActive : {}) }}
          onClick={() => setActiveTab('decor')}
        >
          🎨 Decor AI Gallery
        </button>
      </nav>
      
      <main>
        {activeTab === 'decor' && <DecorGallery />}
      </main>
    </div>
  );
}

const styles = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#f9fafb'
  },
  nav: {
    display: 'flex',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e5e7eb'
  },
  navBtn: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500
  },
  navBtnActive: {
    backgroundColor: '#eef2ff',
    color: '#4f46e5'
  }
};

export default App;
