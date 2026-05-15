import React from 'react';
import '../styles/SopViewer.css';

interface SopViewerProps {
  url?: string;
  onClose: () => void;
}

const SopViewer: React.FC<SopViewerProps> = ({ url = 'https://desi-sop.vercel.app/', onClose }) => {
  return (
    <div className="sop-viewer-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="SOP Documentation">
      <div className="sop-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <button 
          className="sop-close-button" 
          onClick={onClose}
          aria-label="Close SOP viewer"
        >
          ✕
        </button>
        <iframe
          src={url}
          className="sop-iframe"
          title="DesiOS SOP Documentation"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  );
};

export default SopViewer;
