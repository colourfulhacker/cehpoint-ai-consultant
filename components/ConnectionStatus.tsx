import React, { useState, useEffect } from 'react';

const ConnectionStatus: React.FC = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showStatus, setShowStatus] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setShowStatus(true);
            setTimeout(() => setShowStatus(false), 3000);
        };

        const handleOffline = () => {
            setIsOnline(false);
            setShowStatus(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!showStatus && isOnline) return null;

    return (
        <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${showStatus ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg ${isOnline
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                }`}>
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-white' : 'bg-white animate-pulse'}`}></div>
                <span className="text-sm font-semibold">
                    {isOnline ? 'Back Online' : 'No Internet Connection'}
                </span>
            </div>
        </div>
    );
};

export default ConnectionStatus;
