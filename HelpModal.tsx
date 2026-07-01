import React from 'react';
import { Keyboard, Compass, LifeBuoy, Zap, Shield } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div id="help-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#050c14] border border-[#00f5ff]/20 max-w-lg w-full rounded-none shadow-2xl p-7 relative overflow-hidden">
        {/* Holographic scanner top light */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00f5ff] to-transparent" />
        
        <div className="flex justify-between items-start mb-5">
          <div>
            <span className="font-mono text-[9px] text-[#00f5ff] uppercase tracking-[0.25em] block mb-1">
              MISSION PROTOCOL SPEC-3D
            </span>
            <h3 className="font-serif italic font-light text-2xl text-white tracking-tight">
              3D Abyss Navigation Manual
            </h3>
          </div>
        </div>

        <div className="space-y-4 font-sans text-xs text-gray-300">
          {/* Controls */}
          <div className="flex gap-3.5 items-start">
            <div className="p-2 bg-[#03070b] rounded-none border border-white/5 shrink-0">
              <Keyboard className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h4 className="font-mono text-[9px] uppercase tracking-wider text-white font-bold mb-1">
                Roblox-Style 3D Controls
              </h4>
              <p className="text-gray-400 leading-relaxed text-[11px]">
                Use <span className="px-1.5 py-0.5 bg-[#03070b] border border-white/10 font-mono text-white">WASD</span> or <span className="px-1.5 py-0.5 bg-[#03070b] border border-white/10 font-mono text-white">ARROW KEYS</span> to run on the raft or swim. <span className="text-[#00f5ff] font-bold">SPACE</span> jumps or swims upwards; <span className="text-purple-400 font-bold">L-SHIFT</span> swims downwards.
              </p>
            </div>
          </div>

          {/* Camera */}
          <div className="flex gap-3.5 items-start">
            <div className="p-2 bg-[#03070b] rounded-none border border-white/5 shrink-0">
              <Compass className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h4 className="font-mono text-[9px] uppercase tracking-wider text-white font-bold mb-1">
                Orbit Camera & Targeting
              </h4>
              <p className="text-gray-400 leading-relaxed text-[11px]">
                <span className="text-[#00f5ff] font-bold">Drag your mouse / finger</span> anywhere on the 3D window to orbit the camera 360° around the diver. Your WASD direction automatically aligns with the camera's look angle!
              </p>
            </div>
          </div>

          {/* Harpoon Combat */}
          <div className="flex gap-3.5 items-start">
            <div className="p-2 bg-[#03070b] rounded-none border border-white/5 shrink-0">
              <Shield className="w-4 h-4 text-[#00f5ff]" />
            </div>
            <div>
              <h4 className="font-mono text-[9px] uppercase tracking-wider text-white font-bold mb-1">
                🔱 Harpoon Defense
              </h4>
              <p className="text-gray-400 leading-relaxed text-[11px]">
                <span className="text-[#00f5ff] font-bold">Left Click</span> on the 3D screen to launch high-speed harpoon spears in your forward direction. Use them to destroy predators and dangerous urchins!
              </p>
            </div>
          </div>

          {/* Life support */}
          <div className="flex gap-3.5 items-start">
            <div className="p-2 bg-[#03070b] rounded-none border border-white/5 shrink-0">
              <LifeBuoy className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h4 className="font-mono text-[9px] uppercase tracking-wider text-white font-bold mb-1">
                Oxygen & Safe Refills
              </h4>
              <p className="text-gray-400 leading-relaxed text-[11px]">
                Oxygen drains underwater. Climb back up to the wooden raft deck (swim up to Y=0 near the raft) to instantly deposit resources, claim your SOL bounty, and fully replenish your tank!
              </p>
            </div>
          </div>

          {/* Hazards */}
          <div className="flex gap-3.5 items-start">
            <div className="p-2 bg-[#03070b] rounded-none border border-white/5 shrink-0">
              <Zap className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <h4 className="font-mono text-[9px] uppercase tracking-wider text-white font-bold mb-1">
                Predators & Anomalies
              </h4>
              <p className="text-gray-400 leading-relaxed text-[11px]">
                Avoid spikes and chasing sharks. Getting bitten drains oxygen. Defeating hazards with harpoons yields premium <span className="text-orange-400 font-bold">Shark Teeth</span> used for advanced upgrades.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3.5 bg-[#00f5ff] hover:bg-white text-black font-mono font-bold text-xs uppercase tracking-[0.15em] transition-colors rounded-none cursor-pointer"
        >
          Initialize Subsea Mission
        </button>
      </div>
    </div>
  );
};
