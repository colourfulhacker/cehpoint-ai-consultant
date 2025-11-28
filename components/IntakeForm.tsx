import React, { useState } from 'react';
import { UserDetails } from '../types';

interface IntakeFormProps {
  onSubmit: (details: UserDetails) => void;
}

const INTERESTS = [
  "Web Development", "Mobile Apps", "Cybersecurity", 
  "AI Integration", "Marketing Automation", "Digital Marketing", 
  "Business Consulting", "Cloud Solutions"
];

const IntakeForm: React.FC<IntakeFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState<UserDetails>({
    name: '',
    email: '',
    phone: '',
    company: '',
    interest: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = { 
        ...formData, 
        interest: formData.interest || 'Business Consulting' 
    };
    
    if (formData.name && formData.company) {
      onSubmit(finalData);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const selectInterest = (interest: string) => {
    setFormData({ ...formData, interest });
  }

  return (
    <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 animate-fade-in-up flex flex-col md:flex-row">
      {/* Sidebar / Decorative Side */}
      <div className="bg-slate-900 p-8 md:w-1/3 flex flex-col justify-between text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-900 to-slate-900 opacity-90 z-0"></div>
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-500 rounded-full blur-3xl opacity-20"></div>
        
        <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2">Cehpoint Solutions</h2>
            <p className="text-blue-200 text-sm">Your Digital India Growth Partner.</p>
        </div>

        <div className="relative z-10 mt-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">The Cehpoint Advantage</p>
            <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-center gap-2"><svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> Affordable Innovation</li>
                <li className="flex items-center gap-2"><svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> Free Lifetime Hosting</li>
                <li className="flex items-center gap-2"><svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> Brand Marketing Support</li>
            </ul>
        </div>
        
        <div className="relative z-10 mt-6">
            <p className="text-xs text-blue-300 italic">"Let's grow together and make a real impact."</p>
        </div>
      </div>

      {/* Form Side */}
      <div className="p-8 md:p-10 md:w-2/3 bg-white">
        <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Start Your Growth Journey</h1>
            <p className="text-slate-500 text-sm">Connect with Dhanalakshmi AI, your dedicated consultant.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Full Name</label>
                    <input
                        type="text"
                        name="name"
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={handleChange}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Company Name</label>
                    <input
                        type="text"
                        name="company"
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                        placeholder="Acme Inc."
                        value={formData.company}
                        onChange={handleChange}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Email Address</label>
                    <input
                        type="email"
                        name="email"
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={handleChange}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Phone</label>
                    <input
                        type="tel"
                        name="phone"
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                        placeholder="+91 ..."
                        value={formData.phone}
                        onChange={handleChange}
                    />
                </div>
            </div>

            <div className="space-y-2">
                 <label className="text-xs font-semibold text-slate-700">Area of Interest</label>
                 <div className="flex flex-wrap gap-2">
                    {INTERESTS.map((item) => (
                        <button
                            type="button"
                            key={item}
                            onClick={() => selectInterest(item)}
                            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                                formData.interest === item 
                                ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                            }`}
                        >
                            {item}
                        </button>
                    ))}
                 </div>
            </div>

            <button
              type="submit"
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 group"
            >
              <span>Connect Now</span>
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
        </form>
      </div>
    </div>
  );
};

export default IntakeForm;