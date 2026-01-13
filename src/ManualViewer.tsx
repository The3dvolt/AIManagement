import React from 'react';

interface ManualViewerProps {
    htmlContent: string;
    onClose: () => void;
}

export const ManualViewer: React.FC<ManualViewerProps> = ({ htmlContent, onClose }) => {
    const handleEmail = () => {
        const subject = encodeURIComponent("AI Management User Manual");
        const body = encodeURIComponent("Please find the manual content below:\n\n" + htmlContent);
        window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000,
            display: 'flex', flexDirection: 'column', padding: '20px'
        }}>
            <div style={{
                backgroundColor: 'white', flex: 1, borderRadius: '8px',
                overflow: 'hidden', display: 'flex', flexDirection: 'column'
            }}>
                <div style={{
                    padding: '10px', borderBottom: '1px solid #eee',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <h2 style={{ margin: 0 }}>User Manual</h2>
                    <div>
                        <button onClick={handleEmail} style={{ marginRight: '10px', padding: '5px 10px' }}>
                            Email Manual
                        </button>
                        <button onClick={onClose} style={{ padding: '5px 10px' }}>
                            Close
                        </button>
                    </div>
                </div>
                <iframe 
                    srcDoc={htmlContent} 
                    style={{ flex: 1, border: 'none', width: '100%' }} 
                    title="User Manual"
                />
            </div>
        </div>
    );
};