import React from 'react';
import ReactMarkdown from 'react-markdown';

interface ProposalViewProps {
    proposalText: string;
    onReset: () => void;
}

const ProposalView: React.FC<ProposalViewProps> = ({ proposalText, onReset }) => {
    // Strip any system tags if they leaked into the output
    const cleanText = proposalText.replace(/\[CONSULTATION_COMPLETED\]/g, '').trim();

    const handleDownload = () => {
        const element = document.createElement("a");
        const file = new Blob([cleanText], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = "Cehpoint_Business_Proposal.txt";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="w-full max-w-5xl mx-auto my-10 animate-fade-in-up proposal-container">
            {/* Actions Bar - Hidden on Print */}
            <div className="no-print flex justify-between items-center mb-6 px-4">
                <button
                    onClick={onReset}
                    className="text-slate-500 hover:text-slate-800 font-medium flex items-center gap-2 text-sm transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    Back to Home
                </button>
                <div className="flex gap-3">
                    <button
                        onClick={handleDownload}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors shadow-sm text-sm flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        Save Text
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 text-sm flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                        Print
                    </button>
                    <button
                        onClick={() => {
                            alert("To save as PDF:\n1. Click 'OK' to open Print Dialog\n2. Select 'Save as PDF' in Destination");
                            window.print();
                        }}
                        className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 text-sm flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Save as PDF
                    </button>
                </div>
            </div>

            {/* Proposal Document Paper */}
            <div className="bg-white rounded-none md:rounded-xl shadow-2xl border border-slate-200 overflow-hidden print:shadow-none print:border-none print:w-full">

                {/* Document Header */}
                <div className="bg-slate-900 text-white p-10 print:bg-white print:text-black print:border-b-2 print:border-black print:p-0 print:mb-8">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight mb-2 uppercase">Business Proposal</h1>
                            <p className="text-blue-200 text-sm print:text-slate-600">Prepared by Dhanalakshmi AI (Cehpoint)</p>
                        </div>
                        <div className="text-right hidden sm:block">
                            <div className="text-2xl font-bold tracking-tight">Cehpoint</div>
                            <div className="text-xs text-slate-400 mt-1">Innovation. Transformation. Growth.</div>
                        </div>
                    </div>
                </div>

                {/* Document Content */}
                <div className="p-10 md:p-14 min-h-[600px] prose prose-slate max-w-none prose-headings:font-bold prose-h2:text-blue-800 prose-h3:text-slate-800 prose-table:border-collapse prose-th:bg-slate-100 prose-th:p-3 prose-td:p-3 prose-td:border-b prose-a:text-blue-600 print:p-0 print:prose-sm">
                    <ReactMarkdown
                        components={{
                            h1: ({ node, ...props }) => <h1 className="text-2xl font-bold border-b-2 border-slate-100 pb-4 mb-6" {...props} />,
                            h2: ({ node, ...props }) => <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4 uppercase tracking-wide" {...props} />,
                            ul: ({ node, ...props }) => <ul className="list-disc list-outside space-y-1 ml-4" {...props} />,
                            li: ({ node, ...props }) => <li className="text-slate-700 pl-1" {...props} />,
                            table: ({ node, ...props }) => <div className="overflow-x-auto my-8 border rounded-lg shadow-sm"><table className="w-full text-left" {...props} /></div>,
                            th: ({ node, ...props }) => <th className="bg-blue-50 text-blue-900 font-bold p-3 border-b border-blue-100" {...props} />,
                            td: ({ node, ...props }) => <td className="p-3 border-b border-slate-100 text-slate-700" {...props} />,
                            blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-blue-500 pl-4 italic bg-blue-50/50 py-2 pr-2 my-4 rounded-r" {...props} />
                        }}
                    >
                        {cleanText}
                    </ReactMarkdown>
                </div>

                {/* Document Footer */}
                <div className="bg-slate-50 p-10 border-t border-slate-200 print:bg-white print:border-t-2 print:border-black print:p-0 print:mt-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="font-bold text-slate-900 mb-2">Acceptance & Next Steps</h4>
                            <p className="text-sm text-slate-600 mb-4">
                                To proceed with this proposal, please contact our dedicated sales team. This estimate is valid for 30 days.
                            </p>
                            <a
                                href="mailto:sales@cehpoint.co.in"
                                className="inline-block px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg no-print hover:bg-blue-700 transition-colors"
                            >
                                Email Approval
                            </a>
                        </div>
                        <div className="text-sm text-slate-500 md:text-right">
                            <p className="font-bold text-slate-900">Cehpoint Solutions</p>
                            <p>+91 33690 29331</p>
                            <p>sales@cehpoint.co.in</p>
                            <p>www.cehpoint.co.in</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="text-center mt-8 text-slate-400 text-xs no-print">
                &copy; {new Date().getFullYear()} Cehpoint. All rights reserved. Generated by Dhanalakshmi AI.
            </div>
        </div>
    );
};

export default ProposalView;