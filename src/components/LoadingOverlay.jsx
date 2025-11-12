// Loading Overlay Component
import React from 'react';

function LoadingOverlay({ message = 'Loading...' }) {
    return (
        <div className="loading-overlay">
            <div className="text-center">
                <div className="loader mx-auto mb-4"></div>
                <div className="text-white loading-text">{message}</div>
            </div>
        </div>
    );
}

export default LoadingOverlay;