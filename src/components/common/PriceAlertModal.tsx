import React, { useState } from 'react';
import { X, BellRing, Check, ShieldCheck } from 'lucide-react';
import type { Deal } from '../../types';
import { formatINR } from '../../utils/formatters';
import { getHighResImageUrl } from '../../utils/dealLogic';
import { useToast } from './Toast';

interface PriceAlertModalProps {
  deal: Deal | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PriceAlertModal: React.FC<PriceAlertModalProps> = ({ deal, isOpen, onClose }) => {
  const { showToast } = useToast();
  const [contactType, setContactType] = useState<'whatsapp' | 'email'>('whatsapp');
  const [contactValue, setContactValue] = useState('');
  const [targetPrice, setTargetPrice] = useState<number>(
    deal ? Math.round(deal.dealPrice * 0.9) : 0
  );
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen || !deal) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactValue.trim()) return;

    setSubmitted(true);
    setTimeout(() => {
      showToast(`Price drop alert set for ₹${targetPrice.toLocaleString('en-IN')}!`, 'success');
      setSubmitted(false);
      setContactValue('');
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white border border-[#EAE6DF] rounded-2xl shadow-xl overflow-hidden p-6 animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1.5 rounded-full hover:bg-stone-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-2 text-orange-600">
          <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
            <BellRing className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-900 leading-tight">Price Drop Tracker</h3>
            <p className="text-xs text-stone-500">Get notified when this item gets cheaper</p>
          </div>
        </div>

        <div className="my-4 p-3 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl flex items-center gap-3">
          <img
            src={getHighResImageUrl(deal.imageUrl)}
            alt={deal.title}
            onError={(e) => {
              if (e.currentTarget.src !== deal.imageUrl && deal.imageUrl) {
                e.currentTarget.src = deal.imageUrl;
              }
            }}
            className="w-12 h-12 object-contain p-1 rounded-lg border border-stone-200 bg-white"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-semibold text-stone-900 truncate">{deal.title}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-bold text-stone-900">{formatINR(deal.dealPrice)}</span>
              <span className="text-xs text-stone-400 line-through">{formatINR(deal.originalPrice)}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Notify me when price drops below:
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 font-bold">₹</span>
              <input
                type="number"
                value={targetPrice}
                onChange={(e) => setTargetPrice(Number(e.target.value))}
                className="w-full pl-8 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                required
              />
            </div>
            <div className="flex gap-2 mt-2">
              {[0.9, 0.8, 0.7].map((factor) => {
                const price = Math.round(deal.dealPrice * factor);
                return (
                  <button
                    key={factor}
                    type="button"
                    onClick={() => setTargetPrice(price)}
                    className="text-[11px] font-medium px-2.5 py-1 bg-white border border-[#EAE6DF] hover:border-stone-400 rounded-lg text-stone-700 transition-colors"
                  >
                    {Math.round((1 - factor) * 100)}% lower ({formatINR(price)})
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Delivery channel:
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => setContactType('whatsapp')}
                className={`py-2 px-3 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                  contactType === 'whatsapp'
                    ? 'bg-[#25D366]/10 border-[#25D366] text-stone-900'
                    : 'bg-white border-[#EAE6DF] text-stone-600 hover:bg-stone-50'
                }`}
              >
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => setContactType('email')}
                className={`py-2 px-3 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                  contactType === 'email'
                    ? 'bg-orange-50 border-orange-500 text-orange-950'
                    : 'bg-white border-[#EAE6DF] text-stone-600 hover:bg-stone-50'
                }`}
              >
                <span>Email</span>
              </button>
            </div>

            <input
              type={contactType === 'whatsapp' ? 'tel' : 'email'}
              placeholder={contactType === 'whatsapp' ? 'Enter 10-digit WhatsApp number' : 'Enter your email address'}
              value={contactValue}
              onChange={(e) => setContactValue(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-stone-500 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <span>We never spam. You only receive price alert pings for this item.</span>
          </div>

          <button
            type="submit"
            disabled={submitted}
            className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitted ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Alert Created!</span>
              </>
            ) : (
              <span>Create Price Drop Alert</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
