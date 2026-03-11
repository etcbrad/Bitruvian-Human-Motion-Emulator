
import React, { useState, useEffect, useRef, useCallback } from 'react';
import saveAs from 'file-saver';
import { WalkingEnginePose, WalkingEngineGait, WalkingEnginePivotOffsets, WalkingEngineProportions, Vector2D } from './types';
import { ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT, MANNEQUIN_LOCAL_FLOOR_Y } from './constants'; 
import { Scanlines, SystemGuides } from './components/SystemGrid';
import { Mannequin } from './components/Mannequin';
import { lerp, easeInOutQuint } from './utils/kinematics'; // Import lerp and easeInOutQuint for smooth transitions

// New CollapsibleSection component
interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  disabled?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, defaultOpen = true, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`flex flex-col gap-2 p-4 border rounded shadow-lg ${disabled ? 'border-ridge bg-mono-darker/50 opacity-50' : 'border-ridge bg-mono-dark'}`}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex justify-between items-center w-full text-[10px] text-selection font-bold tracking-[0.2em] uppercase cursor-pointer border-b border-ridge pb-1 ${disabled ? 'text-mono-mid cursor-not-allowed' : 'hover:text-ink transition-colors'}`}
        disabled={disabled}
      >
        <span>{title}</span>
        <span className="text-mono-mid transform transition-transform duration-200">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>
      {isOpen && <div className="pt-2">{children}</div>}
    </div>
  );
};

// --- REBUILT GAIT PRESETS ---
// A cleaner, more foundational set of motion styles.
const gaitPresets: { name: string, gait: WalkingEngineGait }[] = [
  {
    name: 'Walk',
    gait: { intensity: 0.8, stride: 0.55, lean: 0.1, frequency: 1.2, gravity: 0.6, bounce: 0.1, bends: 1.0, head_spin: 0.0, mood: 0.8, ground_drag: 0.2, foot_angle_on_ground: 0, arm_swing: 0.6, elbow_bend: 0.7, wrist_swing: 0.6, foot_roll: 0.6, toe_lift: 0.8, shin_tilt: 0.0, foot_slide: 0.2, kick_up_force: 0.4, hover_height: 0.1, waist_twist: 0.3, hip_sway: 0.4, toe_bend: 0.8 },
  },
  {
    name: 'Bouncy Walk',
    gait: { intensity: 0.9, stride: 0.5, lean: -0.1, frequency: 1.5, gravity: 0.4, bounce: 0.8, bends: 0.8, head_spin: 0.0, mood: 0.9, ground_drag: 0.1, foot_angle_on_ground: 5, arm_swing: 0.8, elbow_bend: 0.6, wrist_swing: 0.7, foot_roll: 0.7, toe_lift: 0.7, shin_tilt: -0.1, foot_slide: 0.1, kick_up_force: 0.5, hover_height: 0.3, waist_twist: 0.4, hip_sway: 0.6, toe_bend: 0.7 },
  },
  {
    name: 'Run',
    gait: { intensity: 1.0, stride: 0.8, lean: 0.05, frequency: 2.2, gravity: 0.3, bounce: 0.3, bends: 0.14, head_spin: 0.0, mood: 1.0, ground_drag: 0.1, foot_angle_on_ground: 0, arm_swing: 1.2, elbow_bend: 0.8, wrist_swing: 0.8, foot_roll: 0.8, toe_lift: 0.8, shin_tilt: 0.0, foot_slide: 0.1, kick_up_force: 0.9, hover_height: 0.2, waist_twist: 0.2, hip_sway: 0.1, toe_bend: 1.0 },
  },
  {
    name: 'Jog',
    gait: { intensity: 0.9, stride: 0.6, lean: 0.1, frequency: 1.8, gravity: 0.5, bounce: 0.4, bends: 0.6, head_spin: 0.0, mood: 0.85, ground_drag: 0.15, foot_angle_on_ground: 0, arm_swing: 1.0, elbow_bend: 0.9, wrist_swing: 0.5, foot_roll: 0.7, toe_lift: 0.6, shin_tilt: 0.0, foot_slide: 0.1, kick_up_force: 0.6, hover_height: 0.15, waist_twist: 0.3, hip_sway: 0.2, toe_bend: 0.9 },
  },
  {
    name: 'Scoot',
    gait: { intensity: 0.7, stride: 0.2, lean: 0.2, frequency: 2.5, gravity: 0.7, bounce: 0.1, bends: 1.2, head_spin: 0.0, mood: 0.6, ground_drag: 0.6, foot_angle_on_ground: 10, arm_swing: 0.1, elbow_bend: 0.3, wrist_swing: 0.1, foot_roll: 0.3, toe_lift: 0.2, shin_tilt: 0.2, foot_slide: 0.8, kick_up_force: 0.1, hover_height: 0.0, waist_twist: 0.8, hip_sway: 1.0, toe_bend: 0.4 },
  },
];


// Helper function for foot planting IK
const calculateLegVerticalHeight = (
    legAngles: { hip: number; knee: number; foot: number; toe: number; },
    proportions: WalkingEngineProportions,
    baseUnitH: number,
    isRight: boolean
): number => {
    const rad = (deg: number) => deg * Math.PI / 180;

    const thighKey = isRight ? 'r_upper_leg' : 'l_upper_leg';
    const calfKey = isRight ? 'r_lower_leg' : 'l_lower_leg';
    const footKey = isRight ? 'r_foot' : 'l_foot';
    const toeKey = isRight ? 'r_toe' : 'l_toe';

    const thighLength = (proportions[thighKey]?.h ?? 1) * ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LEG_UPPER * baseUnitH;
    const calfLength = (proportions[calfKey]?.h ?? 1) * ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LEG_LOWER * baseUnitH;
    const footLength = (proportions[footKey]?.h ?? 1) * ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.FOOT * baseUnitH;
    const toeLength = (proportions[toeKey]?.h ?? 1) * ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.TOE * baseUnitH;

    const hipRad = rad(legAngles.hip);
    const kneeRad = rad(legAngles.knee);
    const footRad = rad(legAngles.foot);
    const toeRad = rad(legAngles.toe);

    const y = thighLength * Math.cos(hipRad) +
              calfLength * Math.cos(hipRad + kneeRad) +
              footLength * Math.cos(hipRad + kneeRad + footRad) +
              toeLength * Math.cos(hipRad + kneeRad + footRad + toeRad);

    return y;
};

const gaitSliderConfig: Record<keyof Omit<WalkingEngineGait, 'head_spin'>, { min: number; max: number; step: number; label: string }> = {
  intensity: { min: 0, max: 2, step: 0.01, label: 'Intensity' },
  stride: { min: 0, max: 2, step: 0.01, label: 'Stride Length' },
  lean: { min: -1, max: 1, step: 0.01, label: 'Body Lean' },
  frequency: { min: 0.1, max: 5, step: 0.01, label: 'Frequency' },
  gravity: { min: 0, max: 1, step: 0.01, label: 'Gravity' },
  bounce: { min: 0, max: 2, step: 0.01, label: 'Bounce' },
  bends: { min: 0, max: 2, step: 0.01, label: 'Limb Bendiness' },
  mood: { min: 0, max: 1, step: 0.01, label: 'Mood' },
  ground_drag: { min: 0, max: 1, step: 0.01, label: 'Ground Drag' },
  foot_angle_on_ground: { min: -45, max: 45, step: 1, label: 'Foot Angle' },
  arm_swing: { min: 0, max: 2, step: 0.01, label: 'Arm Swing' },
  elbow_bend: { min: 0, max: 1, step: 0.01, label: 'Elbow Bend' },
  wrist_swing: { min: 0, max: 2, step: 0.01, label: 'Wrist Swing' },
  foot_roll: { min: 0, max: 1, step: 0.01, label: 'Foot Roll' },
  toe_lift: { min: 0, max: 1, step: 0.01, label: 'Toe Lift' },
  shin_tilt: { min: -1, max: 1, step: 0.01, label: 'Shin Tilt' },
  foot_slide: { min: 0, max: 1, step: 0.01, label: 'Foot Slide' },
  kick_up_force: { min: 0, max: 1, step: 0.01, label: 'Kick Up Force' },
  hover_height: { min: 0, max: 1, step: 0.01, label: 'Hover Height' },
  waist_twist: { min: 0, max: 2, step: 0.01, label: 'Waist Twist' },
  hip_sway: { min: 0, max: 2, step: 0.01, label: 'Hip Sway' },
  toe_bend: { min: 0, max: 2, step: 0.01, label: 'Toe Bend' },
};


const App: React.FC = () => {
  const [showPivots, setShowPivots] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [bobblehead, setBobblehead] = useState(false);
  const [isGlideMode, setIsGlideMode] = useState(false); // New state for glide mode
  const [isPaused, setIsPaused] = useState(false);
  const [targetFps, setTargetFps] = useState(60);
  const H = 150; // Base unit from the walking engine, adjusted for visual size (was 50, now tripled)

  // Fixed viewBox for consistent SVG coordinate system
  const currentViewBox = "-1000 -1500 2000 2000"; // Changed to a square aspect ratio
  const viewBoxArray = currentViewBox.split(' ').map(Number);
  
  // Visual floor Y position in the SVG coordinate system
  const visualFloorY = 500; // An absolute Y coordinate within the viewBox for the floor

  // Calculate the base Y position of the mannequin's root to place its feet on the floor
  const mannequinBaseYTranslation = visualFloorY - (MANNEQUIN_LOCAL_FLOOR_Y * H);

  // State for Pause Transition
  const [isTransitioningToRest, setIsTransitioningToRest] = useState(false);
  const transitionStartTimeRef = useRef(0);
  const initialPoseOnPauseRef = useRef<WalkingEnginePose | null>(null);
  const PAUSE_TRANSITION_DURATION = 2000; // milliseconds for smooth transition

  const RESTING_POSE: WalkingEnginePose = {
    waist: 0,
    neck: 0, collar: 0, torso: 0, l_shoulder: 90, r_shoulder: -90, l_elbow: 0, r_elbow: 0, l_hand: 0, r_hand: 0, l_hip: 0, r_hip: 0, l_knee: 0, r_knee: 0, l_foot: 0, r_foot: 0, l_toe: 0, r_toe: 0, stride_phase: 0, y_offset: 0, x_offset: 0,
  };

  const [gait, setGait] = useState<WalkingEngineGait>(gaitPresets[0].gait);
  const [activePresetIndex, setActivePresetIndex] = useState(0);
  const targetGaitRef = useRef<WalkingEngineGait>(gaitPresets[0].gait);
  const gaitRef = useRef(gait);
  useEffect(() => { gaitRef.current = gait; }, [gait]);

  const [pose, setPose] = useState<WalkingEnginePose>({
    waist: 0,
    neck: 0, collar: 0, torso: 0, l_shoulder: 15, r_shoulder: -15, l_elbow: 0, r_elbow: 0, l_hand: 0, r_hand: 0, l_hip: 0, r_hip: 0, l_knee: 0, r_knee: 0, l_foot: 0, r_foot: 0, l_toe: 0, r_toe: 0, stride_phase: 0, y_offset: 0, x_offset: 0 
  });

  const [pivotOffsets, setPivotOffsets] = useState<WalkingEnginePivotOffsets>({
    neck: 0, collar: 0, torso: 0, l_shoulder: 0, r_shoulder: 0, l_elbow: 0, r_elbow: 0, l_hand: 0, r_hand: 0, l_hip: 0, r_hip: 0, l_knee: 0, r_knee: 0, l_foot: 0, r_foot: 0, l_toe: 12, r_toe: 10
  });

  const headSpring = useRef({ pos: 0, vel: 0 });
  const smoothedWaistTwistRef = useRef(0);
  const smoothedTorsoLeanRef = useRef(0);
  const smoothedWaistSwayRef = useRef(0);
  const smoothedBodySwayXRef = useRef(0);
  const smoothedBobbingRef = useRef(0);
  const animationCycleCountRef = useRef(0);
  const lastPhaseRef = useRef(0);

  const [props, setProps] = useState<WalkingEngineProportions>({
    head: { w: 1, h: 1 }, collar: { w: 1, h: 1 }, torso: { w: 1, h: 1 }, waist: { w: 1, h: 1 }, l_upper_arm: { w: 1, h: 1 }, l_lower_arm: { w: 1, h: 1 }, l_hand: { w: 0.5, h: 1 }, r_upper_arm: { w: 1, h: 1 }, r_lower_arm: { w: 1, h: 1 }, r_hand: { w: 0.5, h: 1 }, l_upper_leg: { w: 1, h: 1 }, l_lower_leg: { w: 1, h: 1 }, l_foot: { w: 0.5, h: 1 }, r_upper_leg: { w: 1, h: 1 }, r_lower_leg: { w: 1, h: 1 }, r_foot: { w: 0.5, h: 1 }, l_toe: { w: 1, h: 1 }, r_toe: { w: 1, h: 1 },
  });

  const [showSplash, setShowSplash] = useState(true);

  const [isRecording, setIsRecording] = useState(false);
  const [recordFrameCount, setRecordFrameCount] = useState(60);
  const framesRecordedRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [draggingBoneKey, setDraggingBoneKey] = useState<keyof WalkingEnginePivotOffsets | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartPivotOffsetRef = useRef(0);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const lastFrameTimeRef = useRef(0);

  useEffect(() => {
    let frame: number;
    const SMART_FPS_THRESHOLD = 24;

    const animate = (time: number) => {
      frame = requestAnimationFrame(animate);
      const fpsInterval = 1000 / targetFps;
      const elapsed = time - lastFrameTimeRef.current;
      if (elapsed < fpsInterval) return;
      lastFrameTimeRef.current = time - (elapsed % fpsInterval);

      if (isRecording) {
        framesRecordedRef.current += 1;
        if (framesRecordedRef.current >= recordFrameCount) {
            mediaRecorderRef.current?.stop();
        }
      }

      if (isPaused && !isRecording) {
        if (isTransitioningToRest) {
          const rawT = Math.min(1, (performance.now() - transitionStartTimeRef.current) / PAUSE_TRANSITION_DURATION);
          const t = easeInOutQuint(rawT);
          if (rawT < 1) {
            setPose(prevPose => {
              const newPose: WalkingEnginePose = {} as WalkingEnginePose;
              for (const key in RESTING_POSE) {
                if (RESTING_POSE.hasOwnProperty(key)) {
                  const poseKey = key as keyof WalkingEnginePose;
                  if (initialPoseOnPauseRef.current && typeof initialPoseOnPauseRef.current[poseKey] === 'number') {
                    (newPose[poseKey] as any) = lerp(initialPoseOnPauseRef.current[poseKey] as number, RESTING_POSE[poseKey] as number, t);
                  } else { (newPose[poseKey] as any) = RESTING_POSE[poseKey]; }
                }
              }
              return newPose;
            });
          } else { setPose(RESTING_POSE); setIsTransitioningToRest(false); }
        }
        return;
      }

      const currentGait = gaitRef.current;
      let p = (time * 0.005 * currentGait.frequency) % (Math.PI * 2);
      
      if (targetFps < SMART_FPS_THRESHOLD) {
        const timeForCycleMs = (2 * Math.PI) / (0.005 * currentGait.frequency);
        const numSteps = Math.max(2, Math.round(timeForCycleMs / (1000 / targetFps)));
        const phaseStep = (2 * Math.PI) / numSteps;
        p = Math.round(p / phaseStep) * phaseStep;
      }
      
      if (p < lastPhaseRef.current) {
        animationCycleCountRef.current += 1;
        if (animationCycleCountRef.current % 2 === 0) {
          const targetGait = targetGaitRef.current;
          const currentGaitState = gaitRef.current;
          const stepFactor = 0.33;
          const nextGait = { ...currentGaitState };
          let isDifferent = false;
          for (const key in targetGait) {
            const typedKey = key as keyof WalkingEngineGait;
            const currentVal = nextGait[typedKey];
            const targetVal = targetGait[typedKey];
            if (typeof currentVal === 'number' && typeof targetVal === 'number' && Math.abs(currentVal - targetVal) > 0.01) {
              (nextGait[typedKey] as any) = lerp(currentVal, targetVal, stepFactor);
              isDifferent = true;
            } else if (typeof currentVal === 'number' && typeof targetVal === 'number') {
              if (nextGait[typedKey] !== targetVal) {
                (nextGait[typedKey] as any) = targetVal;
                isDifferent = true;
              }
            }
          }
          if (isDifferent) {
            setGait(nextGait);
          }
        }
      }
      lastPhaseRef.current = p;

      const strideVal = Math.sin(p);
      const counterStride = Math.sin(p + Math.PI);
      
      const moodFactor = currentGait.mood;
      
      const moodTorso = (moodFactor - 0.5) * -40;
      // Recalibrated lean: Use cosine to create a rocking motion for balance
      const dynamicLean = Math.cos(p * 2) * 8 * currentGait.intensity; // Use p*2 for a quicker rock
      const torsoLeanTarget = (currentGait.lean * 35) + moodTorso + dynamicLean;
      smoothedTorsoLeanRef.current = lerp(smoothedTorsoLeanRef.current, torsoLeanTarget, 0.1);
      const torsoLean = smoothedTorsoLeanRef.current;
      
      const waistTwistTarget = counterStride * 20 * currentGait.waist_twist * currentGait.intensity;
      smoothedWaistTwistRef.current = lerp(smoothedWaistTwistRef.current, waistTwistTarget, 0.1);
      const waistTwist = smoothedWaistTwistRef.current;

      const hipSwayMagnitude = 25 * currentGait.hip_sway * currentGait.intensity;
      const waistSwayTarget = Math.cos(p * 2) * hipSwayMagnitude * 0.5;
      smoothedWaistSwayRef.current = lerp(smoothedWaistSwayRef.current, waistSwayTarget, 0.1);
      const waistSway = smoothedWaistSwayRef.current;
      const bodySwayXTarget = Math.sin(p * 2) * hipSwayMagnitude * 0.5; // Use sin for smoother side-to-side
      smoothedBodySwayXRef.current = lerp(smoothedBodySwayXRef.current, bodySwayXTarget, 0.1);
      const bodySwayX = smoothedBodySwayXRef.current;

      let headBobble = 0;
      if (bobblehead) {
        const target = -torsoLean * 0.6;
        const force = (target - headSpring.current.pos) * 0.12;
        headSpring.current.vel += force;
        headSpring.current.vel *= 0.82;
        headSpring.current.pos += headSpring.current.vel;
        headBobble = headSpring.current.pos;
      }
      
      const armSwingMagnitude = (20 + (currentGait.stride * 45)) * (0.4 + moodFactor) * currentGait.arm_swing;
      const baseElbowBend = -30 * currentGait.elbow_bend;
      const dynamicElbowAmplitude = 60 * currentGait.arm_swing * currentGait.intensity * currentGait.bends;
      const elbowPhaseOffset = Math.PI * 0.05;
      const lElbowDrive = Math.cos(p + Math.PI + elbowPhaseOffset);
      const rElbowDrive = Math.cos(p + elbowPhaseOffset);
      const wristPhaseOffset = Math.PI * 0.15;
      const lWristDrive = Math.cos(p + Math.PI + wristPhaseOffset);
      const rWristDrive = Math.cos(p + wristPhaseOffset);

      let l_hip = 0, l_knee = 0, l_foot = 0, r_hip = 0, r_knee = 0, r_foot = 0, l_toe = 0, r_toe = 0, bobbing = 0;

      if (isGlideMode) {
        bobbing = currentGait.gravity * 15;
        const glideKneeBend = 45;
        const glideHipRange = 30 * currentGait.stride;
        l_hip = strideVal * glideHipRange;
        l_knee = glideKneeBend - Math.abs(strideVal) * 20;
        r_hip = counterStride * glideHipRange;
        r_knee = glideKneeBend - Math.abs(counterStride) * 20;
        l_foot = 0; r_foot = 0; l_toe = 0; r_toe = 0;
      } else {
        const calculateLegAngles = (s: number, gait: WalkingEngineGait, phase: number) => {
            const hipMult = (10 + (gait.stride * 35)) * (0.8 + gait.intensity * 0.4) * (0.5 + moodFactor);
            // When s is negative, it's a backswing. Cut this rotation in half.
            const effectiveS = s < 0 ? s * 0.5 : s;
            let hip = effectiveS * hipMult;
            hip -= torsoLean * 0.2;
            let knee = 0, foot = 0, toe = 0;
        
            const normalizedPhase = (phase + 2 * Math.PI) % (2 * Math.PI);
            const isGrounded = normalizedPhase >= Math.PI;
        
            if (isGrounded) {
                // STANCE PHASE
                const stanceProgress = (normalizedPhase - Math.PI) / Math.PI;
                
                const downBend = 25 * (gait.gravity + gait.bends * 0.2);
                const passingStraightness = 5;
                if (stanceProgress < 0.3) {
                    const t = stanceProgress / 0.3;
                    knee = lerp(0, downBend, easeInOutQuint(t));
                } else {
                    const t = (stanceProgress - 0.3) / 0.7;
                    knee = lerp(downBend, passingStraightness, t);
                }
                knee += gait.ground_drag * 15;
        
                const shinGlobalAngle = hip + knee;
                const flatFootAngle = -shinGlobalAngle + gait.foot_angle_on_ground;
        
                const heelStrikeAngle = 30;
                const toeOffAngle = -90 * (1 - gait.ground_drag * 0.4); // Dampen toe-off with ground drag
        
                if (stanceProgress < 0.1) {
                    const t = stanceProgress / 0.1;
                    foot = lerp(heelStrikeAngle, flatFootAngle, t);
                    toe = lerp(heelStrikeAngle / 2, 0, t);
                } else if (stanceProgress <= 0.7) {
                    foot = flatFootAngle;
                    toe = 0;
                } else {
                    const t = (stanceProgress - 0.7) / 0.3;
                    const heelLiftAngle = lerp(0, toeOffAngle, t) * gait.foot_roll;
                    foot = flatFootAngle + heelLiftAngle;
                    toe = -heelLiftAngle * gait.toe_bend * 1.2;
                }
                
                const slideProgress = Math.sin(stanceProgress * Math.PI);
                const slideAmount = slideProgress * gait.foot_slide * 40 * (1 + gait.gravity * 0.5);
                hip += slideAmount;
                knee -= slideAmount * 0.5;
        
            } else { // SWING PHASE
                const swingProgressLinear = normalizedPhase / Math.PI;
                const swingArcHeight = Math.sin(normalizedPhase);
                
                const clearanceBend = (gait.stride + gait.intensity) * 35 * swingArcHeight;
                const hoverLift = gait.hover_height * 40 * swingArcHeight;
                
                const dragFactor = Math.pow(1 - swingProgressLinear, 5); // Sharpened falloff for a quicker "tug"
                const dragBend = dragFactor * 80 * gait.bends * (1 + gait.ground_drag * 0.5); // Re-balanced drag force

                // Controlled hyperextension "snap" to kick the leg forward from the knee
                const kickForce = -Math.pow(1 - swingProgressLinear, 4) * gait.kick_up_force * 50; // Negative for extension, steep falloff

                knee = clearanceBend + hoverLift + dragBend + kickForce;
                
                const footDragAngle = Math.cos(swingProgressLinear * Math.PI) * -45;
                const footFlickAngle = swingArcHeight * gait.toe_lift * 60;
                foot = footDragAngle + footFlickAngle;
        
                const toeFlick = swingArcHeight * 40 * gait.toe_lift;
                toe = foot * 0.5 + toeFlick;
            }
        
            const shinTiltAmplitude = 25 * gait.shin_tilt * (0.5 + gait.intensity);
            const shinTilt = Math.cos(phase + (Math.PI / 4)) * shinTiltAmplitude;
            knee += shinTilt;
            
            return { hip, knee, foot, toe };
        };
        
          const lLeg = calculateLegAngles(strideVal, currentGait, p);
          const rLeg = calculateLegAngles(counterStride, currentGait, p + Math.PI);
          l_hip = lLeg.hip; l_knee = lLeg.knee; l_foot = lLeg.foot; l_toe = lLeg.toe;
          r_hip = rLeg.hip; r_knee = rLeg.knee; r_foot = rLeg.foot; r_toe = rLeg.toe;
          
          const lLegHeight = calculateLegVerticalHeight(lLeg, props, H, false);
          const rLegHeight = calculateLegVerticalHeight(rLeg, props, H, true);

          const lowestPointY = Math.max(lLegHeight, rLegHeight);
          const floorY = MANNEQUIN_LOCAL_FLOOR_Y * H;
          
          bobbing = floorY - lowestPointY;
          const bounceAmount = -Math.cos(p * 2) * 5 * currentGait.bounce;
          bobbing += bounceAmount;

          const isLLegPlanted = Math.abs((lLegHeight + bobbing) - floorY) < 10;
          const isRLegPlanted = Math.abs((rLegHeight + bobbing) - floorY) < 10;
          const gravityCompression = currentGait.gravity * 12 * currentGait.intensity;

          if (isLLegPlanted) l_knee += gravityCompression;
          if (isRLegPlanted) r_knee += gravityCompression;
      }

      smoothedBobbingRef.current = lerp(smoothedBobbingRef.current, bobbing, 0.2);

      setPose(prev => ({
        ...prev,
        waist: waistTwist + waistSway,
        stride_phase: strideVal,
        y_offset: smoothedBobbingRef.current,
        x_offset: bodySwayX,
        torso: torsoLean,
        collar: -torsoLean * 0.7 + (moodFactor * 15) - waistSway * 0.6,
        neck: -torsoLean * 0.2 - (moodFactor * 20) + (currentGait.head_spin * 180) + headBobble,
        l_hip, l_knee, l_foot, l_toe,
        r_hip, r_knee, r_foot, r_toe,
        l_shoulder: counterStride * armSwingMagnitude,
        l_elbow: baseElbowBend + (lElbowDrive * dynamicElbowAmplitude),
        l_hand: lWristDrive * 50 * currentGait.wrist_swing,
        r_shoulder: strideVal * armSwingMagnitude,
        r_elbow: baseElbowBend + (rElbowDrive * dynamicElbowAmplitude),
        r_hand: rWristDrive * 50 * currentGait.wrist_swing,
      }));
    };
    lastFrameTimeRef.current = performance.now();
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [props, bobblehead, isGlideMode, isPaused, isRecording, targetFps, recordFrameCount]);

  const drawSvgToCanvas = useCallback(() => {
    const svg = svgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!svg || !canvas || !ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);

    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.onerror = (e) => {
      console.error("Error loading SVG for canvas drawing:", e);
    };
    img.src = svgUrl;
  }, []);

  useEffect(() => {
    if (isRecording) {
        drawSvgToCanvas();
    }
  }, [pose, isRecording, drawSvgToCanvas]);

  const handleGaitChange = useCallback((key: keyof WalkingEngineGait, value: string) => {
      const numericValue = parseFloat(value);
      const newGait = { ...gait, [key]: numericValue };
      setGait(newGait);
      targetGaitRef.current = newGait; // Update target immediately for instant response
      setActivePresetIndex(-1); // It's now a custom gait
  }, [gait]);

  const handleRandomizeGait = useCallback(() => {
    const randomGait: WalkingEngineGait = {
      intensity: Math.random() * 0.5 + 0.5,       // 0.5 to 1.0
      stride: Math.random() * 1.0 + 0.2,          // 0.2 to 1.2
      lean: Math.random() * 0.8 - 0.3,            // -0.3 to 0.5
      frequency: Math.random() * 1.7 + 0.8,       // 0.8 to 2.5
      gravity: Math.random() * 0.9 + 0.1,         // 0.1 to 1.0
      bounce: Math.random(),                      // 0.0 to 1.0
      bends: Math.random() * 1.1 + 0.1,           // 0.1 to 1.2
      head_spin: 0.0, // Keep this stable for now
      mood: Math.random(),                        // 0.0 to 1.0
      ground_drag: Math.random() * 0.8,           // 0.0 to 0.8
      foot_angle_on_ground: Math.random() * 40 - 20, // -20 to 20
      arm_swing: Math.random() * 1.5,             // 0.0 to 1.5
      elbow_bend: Math.random(),                  // 0.0 to 1.0
      wrist_swing: Math.random() * 1.5,           // 0.0 to 1.5
      foot_roll: Math.random() * 0.9 + 0.1,       // 0.1 to 1.0
      toe_lift: Math.random() * 0.9 + 0.1,        // 0.1 to 1.0
      shin_tilt: Math.random() - 0.5,             // -0.5 to 0.5
      foot_slide: Math.random() * 0.5,            // 0.0 to 0.5
      kick_up_force: Math.random(),               // 0.0 to 1.0
      hover_height: Math.random() * 0.5,          // 0.0 to 0.5
      waist_twist: Math.random(),                 // 0.0 to 1.0
      hip_sway: Math.random() * 1.2,              // 0.0 to 1.2
      toe_bend: Math.random() * 1.1 + 0.1,        // 0.1 to 1.2
    };
    targetGaitRef.current = randomGait;
    setGait(randomGait);
    setActivePresetIndex(-1); // Deselect presets
  }, []);

  const handleTogglePause = useCallback(() => setIsPaused(p => { if (!p) { initialPoseOnPauseRef.current = pose; transitionStartTimeRef.current = performance.now(); setIsTransitioningToRest(true); } else { setIsTransitioningToRest(false); } return !p; }), [pose]);
  const onAnchorMouseDown = useCallback((boneKey: keyof WalkingEnginePivotOffsets, clientX: number) => { if (!isPaused || !showPivots) return; setDraggingBoneKey(boneKey); dragStartXRef.current = clientX; dragStartPivotOffsetRef.current = pivotOffsets[boneKey]; window.addEventListener('mousemove', handleGlobalBoneMouseMove); window.addEventListener('mouseup', handleGlobalBoneMouseUp); }, [isPaused, showPivots, pivotOffsets]);
  const handleGlobalBoneMouseMove = useCallback((event: MouseEvent) => { if (!draggingBoneKey) return; const deltaX = event.clientX - dragStartXRef.current; const newRotation = dragStartPivotOffsetRef.current + deltaX * 0.2; setPivotOffsets(prev => ({ ...prev, [draggingBoneKey]: newRotation })); }, [draggingBoneKey]);
  const handleGlobalBoneMouseUp = useCallback(() => { setDraggingBoneKey(null); window.removeEventListener('mousemove', handleGlobalBoneMouseMove); window.removeEventListener('mouseup', handleGlobalBoneMouseUp); }, []);
  useEffect(() => { return () => { window.removeEventListener('mousemove', handleGlobalBoneMouseMove); window.removeEventListener('mouseup', handleGlobalBoneMouseUp); }; }, [handleGlobalBoneMouseMove, handleGlobalBoneMouseUp]);
  const updateProp = useCallback((piece: keyof WalkingEngineProportions, axis: 'w' | 'h', val: string) => setProps(prev => ({ ...prev, [piece]: { ...prev[piece], [axis]: parseFloat(val) } })), []);
  const updatePivotOffset = useCallback((key: keyof WalkingEnginePivotOffsets, val: string) => setPivotOffsets(prev => ({ ...prev, [key]: parseInt(val) })), []);
  
  const handleStartRecording = useCallback(async () => {
    if (isRecording) return;
    const canvas = canvasRef.current;
    const svg = svgRef.current;
    if (!canvas || !svg) {
      console.error("Canvas or SVG element not found for recording.");
      return;
    }
    try {
      const svgRect = svg.getBoundingClientRect();
      canvas.width = svgRect.width;
      canvas.height = svgRect.height;

      drawSvgToCanvas();

      const stream = canvas.captureStream(targetFps);
      if (isPaused) setIsPaused(false);

      const mimeTypes = ['video/mp4; codecs=avc1', 'video/webm; codecs=vp9', 'video/webm'];
      const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));

      if (!supportedMimeType) {
        alert("Video recording is not supported in this browser.");
        console.error("No supported video format found for recording.");
        return;
      }

      const fileExtension = supportedMimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      const fileName = `bitruvius-loop.${fileExtension}`;

      const recorderOptions = {
        mimeType: supportedMimeType,
        videoBitsPerSecond: 8000000, // 8 Mbps for high quality
      };

      mediaRecorderRef.current = new MediaRecorder(stream, recorderOptions);
      recordedChunksRef.current = [];
      framesRecordedRef.current = 0;
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: supportedMimeType });
        saveAs(blob, fileName);
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Canvas recording failed:", err);
      setIsRecording(false);
    }
  }, [isRecording, isPaused, targetFps, drawSvgToCanvas]);
  
  const handleSavePose = useCallback(() => { const poseData = { proportions: props, pivotOffsets, gait }; const blob = new Blob([JSON.stringify(poseData, null, 2)], { type: 'application/json' }); saveAs(blob, 'bitruvius-pose.json'); }, [props, pivotOffsets, gait]);
  // FIX: The original one-liner for this function was extremely long and likely causing a cryptic parsing error.
  // Refactored for readability and to resolve the issue. The logic remains identical.
  const formatKeyLabel = (key: string) => {
    const capitalizeAndFormat = (str: string) => {
      return str.replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    if (key.startsWith('l_')) return `L. ${capitalizeAndFormat(key.slice(2))}`;
    if (key.startsWith('r_')) return `R. ${capitalizeAndFormat(key.slice(2))}`;
    return capitalizeAndFormat(key);
  };
  useEffect(() => { const timer = setTimeout(() => setShowSplash(false), 2000); return () => clearTimeout(timer); }, []);

  return (
    <div className="flex h-full w-full bg-paper font-mono text-ink overflow-hidden select-none">
      <div className="w-80 border-r border-ridge bg-mono-darker p-4 flex flex-col gap-4 custom-scrollbar overflow-y-auto">
        
        <div className="bg-black rounded-md p-2 aspect-square relative shadow-inner">
            <svg viewBox="-750 -1250 1500 1500" className="w-full h-full">
                <g transform={`translate(${pose.x_offset || 0}, ${mannequinBaseYTranslation + pose.y_offset})`}>
                    <Mannequin 
                        pose={pose} 
                        pivotOffsets={pivotOffsets} 
                        props={props} 
                        showPivots={true} 
                        showLabels={false} 
                        baseUnitH={H} 
                        onAnchorMouseDown={() => {}} 
                        draggingBoneKey={null} 
                        isPaused={isPaused}
                        skeletal={true}
                    />
                </g>
            </svg>
        </div>

        <h1 className="text-xl font-archaic tracking-widest border-b border-ridge pb-2 text-ink uppercase italic">Bitruvius.Physics</h1>
        
        <div className="flex flex-col gap-2">
            <button onClick={handleTogglePause} className={`text-[9px] px-3 py-1 border transition-all ${isPaused ? 'bg-red-500/20 text-accent-red border-accent-red/50' : 'bg-paper/10 text-mono-mid border-ridge hover:bg-ridge'}`}>{isPaused ? 'RESUME LOOP' : 'PAUSE LOOP'}</button>
            <button onClick={() => setShowPivots(!showPivots)} className={`text-[9px] px-3 py-1 border transition-all ${showPivots ? 'bg-selection-super-light text-ink border-selection-super-light' : 'bg-paper/10 text-mono-mid border-ridge hover:bg-ridge'}`}>{showPivots ? 'HIDE ANCHORS' : 'SHOW ANCHORS'}</button>
            <button onClick={() => setShowLabels(!showLabels)} className={`text-[9px] px-3 py-1 border transition-all ${showLabels ? 'bg-selection-super-light text-ink border-selection-super-light' : 'bg-paper/10 text-mono-mid border-ridge hover:bg-ridge'}`}>{showLabels ? 'HIDE LABELS' : 'SHOW LABELS'}</button>
        </div>

        <CollapsibleSection title="Export">
            <div className="flex flex-col gap-2">
                <button onClick={handleSavePose} disabled={isRecording} className={`text-[9px] px-3 py-1 border transition-all font-bold ${isRecording ? 'bg-ridge text-mono-mid opacity-40 cursor-not-allowed' : 'border-mono-mid text-mono-mid opacity-60 hover:bg-ridge'}`}>Save Pose Data</button>
                <button onClick={handleStartRecording} disabled={isRecording} className={`text-[9px] px-3 py-1 border transition-all font-bold ${isRecording ? 'border-red-500/50 bg-red-500/20 text-accent-red animate-pulse' : 'border-mono-mid text-mono-mid opacity-60 hover:bg-ridge'}`}>
                    {isRecording ? `RECORDING ${framesRecordedRef.current}/${recordFrameCount}` : `RECORD LOOP (${recordFrameCount} FRAMES)`}
                </button>
                 <div className="flex flex-col gap-1.5 pt-2">
                    <div className="flex justify-between text-[8px] uppercase font-bold text-mono-light opacity-80">
                        <span>Frames to Record</span><span className="text-selection">{recordFrameCount}</span>
                    </div>
                    <input type="range" min="10" max="300" step="1" value={recordFrameCount} disabled={isRecording} onChange={(e) => setRecordFrameCount(parseInt(e.target.value))} className="w-full accent-selection bg-ridge h-1.5 appearance-none cursor-pointer rounded-full" />
                </div>
            </div>
        </CollapsibleSection>

        <CollapsibleSection title="Procedural Walking Engine" defaultOpen={true}>
            <div className="flex justify-between items-center mb-4 border-b border-ridge pb-2">
                <h2 className="text-[10px] text-selection font-bold tracking-[0.2em] uppercase">Motion Style</h2>
                <div className="flex gap-2 flex-wrap">
                <button onClick={() => setBobblehead(!bobblehead)} className={`text-[8px] px-2 py-0.5 border rounded transition-colors font-bold ${bobblehead ? 'bg-selection text-paper border-selection' : 'border-mono-mid text-mono-mid opacity-60'}`}>BOBBLE: {bobblehead ? 'ON' : 'OFF'}</button>
                <button onClick={() => setIsGlideMode(!isGlideMode)} className={`text-[8px] px-2 py-0.5 border rounded transition-colors font-bold ${isGlideMode ? 'bg-selection text-paper border-selection' : 'border-mono-mid text-mono-mid opacity-60'}`}>GLIDE: {isGlideMode ? 'ON' : 'OFF'}</button>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-2 mb-4">
                {gaitPresets.map((preset, index) => (
                    <button
                        key={preset.name}
                        onClick={() => {
                            targetGaitRef.current = preset.gait;
                            setGait(preset.gait); // Also update live gait for sliders
                            setActivePresetIndex(index);
                        }}
                        className={`text-[9px] px-3 py-1 border transition-all font-bold ${
                            activePresetIndex === index
                                ? 'bg-selection text-paper border-selection'
                                : 'border-mono-mid text-mono-mid opacity-60 hover:bg-ridge'
                        }`}
                    >
                        {preset.name}
                    </button>
                ))}
            </div>
             <button
                onClick={handleRandomizeGait}
                className={`w-full text-[9px] px-3 py-1 border transition-all font-bold mb-4 ${
                    activePresetIndex === -1
                        ? 'bg-selection text-paper border-selection'
                        : 'border-mono-mid text-mono-mid opacity-60 hover:bg-ridge'
                }`}
            >
                Randomize Gait
            </button>
            <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[8px] uppercase font-bold text-mono-light opacity-80">
                    <span>Target FPS</span><span className="text-selection">{targetFps}</span>
                </div>
                <input type="range" min="1" max="60" step="1" value={targetFps} onChange={(e) => setTargetFps(parseInt(e.target.value))} className="w-full accent-selection bg-ridge h-1.5 appearance-none cursor-pointer rounded-full" />
            </div>
             <div className="mt-4 pt-4 border-t border-ridge flex flex-col items-start gap-1 font-mono text-left">
                <div className="text-[10px] text-selection font-bold px-2 border border-selection uppercase tracking-widest">PERPETUAL_LOOP_ACTIVE</div>
                <div className="text-[8px] flex gap-4 text-mono-mid uppercase w-full justify-between"><span>Mood:</span> <span className="text-ink font-bold">{(gait.mood).toFixed(2)}</span></div>
                <div className="text-[8px] flex gap-4 text-mono-mid uppercase w-full justify-between"><span>Drag:</span> <span className="text-ink font-bold">{(gait.ground_drag).toFixed(2)}</span></div>
            </div>
        </CollapsibleSection>
        <CollapsibleSection title="Advanced Gait Controls" defaultOpen={false}>
            <div className="flex flex-col gap-3">
                {(Object.keys(gaitSliderConfig) as Array<keyof typeof gaitSliderConfig>).map(key => {
                    const config = gaitSliderConfig[key];
                    return (
                        <div key={key}>
                            <div className="flex justify-between text-[8px] uppercase font-bold text-mono-light opacity-80">
                                <span>{config.label}</span>
                                <span className="text-selection">{gait[key].toFixed(2)}</span>
                            </div>
                            <input
                                type="range"
                                min={config.min}
                                max={config.max}
                                step={config.step}
                                value={gait[key]}
                                onChange={(e) => handleGaitChange(key, e.target.value)}
                                className="w-full accent-selection bg-ridge h-1.5 appearance-none cursor-pointer rounded-full"
                            />
                        </div>
                    );
                })}
            </div>
        </CollapsibleSection>
        <CollapsibleSection title="Structural Proportions">
            <p className="text-[9px] text-mono-mid italic border-b border-ridge pb-2">Adjust the length and width of each body part.</p>
            {(Object.keys(props) as Array<keyof WalkingEngineProportions>).map(piece => (
                <div key={piece} className="flex flex-col gap-2 p-2 border border-ridge/30 rounded mb-2 last:mb-0">
                    <div className="flex justify-between items-center"><span className="text-[10px] text-selection font-bold uppercase">{formatKeyLabel(piece)}</span></div>
                    <div className="flex justify-between text-[8px] uppercase font-bold text-mono-light opacity-80"><span>Width</span><span className="text-selection">{(props[piece].w).toFixed(2)}x</span></div><input type="range" min="0.1" max="2" step="0.01" value={props[piece].w} onChange={(e) => updateProp(piece, 'w', e.target.value)} className="w-full accent-mono-light bg-ridge h-1 appearance-none cursor-pointer" />
                    <div className="flex justify-between text-[8px] uppercase font-bold text-mono-light opacity-80 mt-2"><span>Height</span><span className="text-selection">{(props[piece].h).toFixed(2)}x</span></div><input type="range" min="0.1" max="2" step="0.01" value={props[piece].h} onChange={(e) => updateProp(piece, 'h', e.target.value)} className="w-full accent-mono-light bg-ridge h-1 appearance-none cursor-pointer" />
                </div>
            ))}
        </CollapsibleSection>
        <CollapsibleSection title="Joint Pivots"><p className="text-[9px] text-mono-mid italic border-b border-ridge pb-2">Set additive rotational offsets for joints.</p>{(Object.keys(pivotOffsets) as Array<keyof WalkingEnginePivotOffsets>).sort().map(key => (<div key={key} className="flex flex-col gap-1 mb-2 last:mb-0"><div className="flex justify-between text-[10px] uppercase font-bold text-mono-light opacity-80"><span>{formatKeyLabel(key)}</span><span className="text-selection">{pivotOffsets[key]}°</span></div><input type="range" min="-360" max="360" value={pivotOffsets[key]} onChange={(e) => updatePivotOffset(key, e.target.value)} className="w-full accent-mono-mid bg-ridge h-1 appearance-none cursor-pointer" /></div>))}</CollapsibleSection>
        <CollapsibleSection title="Live Pose Data" defaultOpen={false}>
          <pre className="text-[9px] text-mono-mid bg-black/5 p-2 rounded overflow-x-auto">
              {JSON.stringify(
                  pose, 
                  (key, value) => typeof value === 'number' ? parseFloat(value.toFixed(1)) : value, 
                  2
              )}
          </pre>
        </CollapsibleSection>
      </div>

      <div ref={containerRef} className="flex-1 relative flex items-center justify-center bg-paper p-8 overflow-hidden">
        {showSplash && (<div className="absolute top-[8%] left-0 right-0 z-30 flex items-center justify-center pointer-events-none"><h1 className="text-6xl font-archaic text-paper/80 animate-terminal-boot tracking-widest uppercase">BITRUVIUS</h1></div>)}
        
        <canvas ref={canvasRef} className="absolute" style={{ display: 'none' }}></canvas>
        
        <svg viewBox={currentViewBox} className="aspect-square max-h-full max-w-full drop-shadow-2xl overflow-visible relative z-10" ref={svgRef}>
          <defs>
            <pattern id="bg_grid" patternUnits="userSpaceOnUse" width="24" height="24">
              <path d="M12 0 L0 12 L12 24 L24 12 Z M0 0 L12 24 L24 0 Z" stroke="rgba(229, 231, 235, 1)" strokeWidth="1" fill="none"/>
            </pattern>
            <pattern id="bg_scanlines" patternUnits="userSpaceOnUse" width="1" height="4">
              <line x1="0" y1="1" x2="1" y2="1" stroke="#E5E7EB" strokeWidth="1" />
            </pattern>
          </defs>

          {/* Background Layers */}
          <rect x={viewBoxArray[0]} y={viewBoxArray[1]} width={viewBoxArray[2]} height={viewBoxArray[3]} fill="#FFFFFF" />
          <rect x={viewBoxArray[0]} y={viewBoxArray[1]} width={viewBoxArray[2]} height={viewBoxArray[3]} fill="url(#bg_grid)" />

          <SystemGuides floorY={visualFloorY} baseUnitH={H} />
          <g transform={`translate(${pose.x_offset || 0}, ${mannequinBaseYTranslation + pose.y_offset})`}>
            <Mannequin pose={pose} pivotOffsets={pivotOffsets} props={props} showPivots={showPivots} showLabels={showLabels} baseUnitH={H} onAnchorMouseDown={onAnchorMouseDown} draggingBoneKey={draggingBoneKey} isPaused={isPaused} skeletal={false} />
          </g>
          
          {/* The Perpetual Square Trap */}
          <rect 
              x={viewBoxArray[0]} 
              y={viewBoxArray[1]} 
              width={viewBoxArray[2]} 
              height={viewBoxArray[3]}
              fill="none"
              stroke="#111827"
              strokeWidth="10"
              className="pointer-events-none"
          />

          {/* Overlay Layer */}
          <rect x={viewBoxArray[0]} y={viewBoxArray[1]} width={viewBoxArray[2]} height={viewBoxArray[3]} fill="url(#bg_scanlines)" opacity="0.2" className="pointer-events-none" />
        </svg>

      </div>
    </div>
  );
};

export default App;
