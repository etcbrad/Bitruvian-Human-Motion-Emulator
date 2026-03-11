
import React from 'react';
import { Bone } from './Bone';
import { ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT, RIGGING } from '../constants';
import { WalkingEnginePose, WalkingEngineProportions, WalkingEnginePivotOffsets } from '../types';

interface MannequinProps {
  pose: WalkingEnginePose;
  pivotOffsets: Record<string, number>;
  props: WalkingEngineProportions;
  showPivots: boolean;
  showLabels: boolean;
  baseUnitH: number; // The 'H' from the walking engine
  onAnchorMouseDown: (boneKey: keyof WalkingEnginePivotOffsets, clientX: number) => void;
  draggingBoneKey: keyof WalkingEnginePivotOffsets | null;
  isPaused: boolean;
  colorClass?: string;
  skeletal?: boolean;
}

export const Mannequin: React.FC<MannequinProps> = ({
  pose,
  pivotOffsets,
  props,
  showPivots,
  showLabels,
  baseUnitH,
  onAnchorMouseDown,
  draggingBoneKey,
  isPaused,
  colorClass = "fill-black",
  skeletal = false,
}) => {
  const getRotation = (partKey: keyof WalkingEnginePose, defaultVal: number = 0) => {
    const partRotation = pose[partKey] || defaultVal;
    const offset = pivotOffsets[partKey as keyof WalkingEnginePivotOffsets] || 0;
    return partRotation + offset;
  };

  // Helper to get scaled dimensions using baseUnitH and prop overrides
  const getScaledDimension = (
    rawAnatomyValue: number, 
    propKey: keyof WalkingEngineProportions, 
    axis: 'w' | 'h'
  ) => {
    const propScale = props[propKey]?.[axis] || 1;
    return rawAnatomyValue * baseUnitH * propScale;
  };

  const isPausedAndPivotsVisible = isPaused && showPivots && !skeletal;

  return (
    <g 
      className={`mannequin-root ${skeletal ? '' : colorClass}`} 
    >
      {/* Root circle for visual center, but no interaction */}
      {showPivots && (
        <circle cx="0" cy="0" r={ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.ROOT_SIZE * baseUnitH * 0.7} fill="#DDDDDD" stroke="#000000" strokeWidth="1" data-no-export={true} />
      )}

      {/* Main Body (Torso -> Collar -> Head) */}
      {/* Waist is the base for the upper body (draws upwards) */}
      <Bone 
        rotation={getRotation('waist')} 
        length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.WAIST, 'waist', 'h')}
        width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.WAIST_WIDTH, 'waist', 'w')}
        variant="waist-teardrop-pointy-up" 
        drawsUpwards 
        showPivots={showPivots} 
        visible={true} 
        showLabel={showLabels}
        label="Waist"
        boneKey="torso" // Using torso as key for waist bone for pivot offset (proximal)
        proportionKey="waist"
        onAnchorMouseDown={onAnchorMouseDown}
        isBeingDragged={draggingBoneKey === 'torso'}
        isPausedAndPivotsVisible={isPausedAndPivotsVisible}
        skeletal={skeletal}
      >
        <Bone 
          rotation={getRotation('torso')} 
          length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.TORSO, 'torso', 'h')}
          width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.TORSO_WIDTH, 'torso', 'w')}
          variant="torso-teardrop-pointy-down" 
          drawsUpwards 
          showPivots={showPivots} 
          visible={true} 
          offset={undefined}
          showLabel={showLabels}
          label="Torso"
          boneKey="torso" 
          proportionKey="torso"
          onAnchorMouseDown={onAnchorMouseDown}
          isBeingDragged={draggingBoneKey === 'torso'}
          isPausedAndPivotsVisible={isPausedAndPivotsVisible}
          skeletal={skeletal}
        >
          <Bone 
            rotation={getRotation('collar')} 
            length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.COLLAR, 'collar', 'h')}
            width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.COLLAR_WIDTH, 'collar', 'w')}
            variant="collar-horizontal-oval-shape" 
            drawsUpwards 
            showPivots={showPivots} 
            visible={true} 
            offset={RIGGING.COLLAR_OFFSET_Y !== 0 ? {x: 0, y: RIGGING.COLLAR_OFFSET_Y * baseUnitH} : undefined}
            showLabel={showLabels}
            label="Collar"
            boneKey="collar" // The collar itself
            proportionKey="collar"
            onAnchorMouseDown={onAnchorMouseDown}
            isBeingDragged={draggingBoneKey === 'collar'}
            isPausedAndPivotsVisible={isPausedAndPivotsVisible}
            skeletal={skeletal}
          >
            {/* HEAD */}
            <Bone 
              rotation={getRotation('neck')} 
              length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.HEAD, 'head', 'h')}
              width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.HEAD_WIDTH, 'head', 'w')}
              variant="head-tall-oval" 
              drawsUpwards 
              showPivots={showPivots} 
              visible={true} 
              offset={{x: 0, y: -ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.HEAD_NECK_GAP_OFFSET * baseUnitH}}
              showLabel={showLabels}
              label="Head"
              boneKey="neck" // Head pivots at neck
              proportionKey="head"
              onAnchorMouseDown={onAnchorMouseDown}
              isBeingDragged={draggingBoneKey === 'neck'}
              isPausedAndPivotsVisible={isPausedAndPivotsVisible}
              skeletal={skeletal}
            />
            
            {/* RIGHT ARM */}
            <g transform={`translate(${RIGGING.R_SHOULDER_X_OFFSET_FROM_COLLAR_CENTER * baseUnitH}, ${RIGGING.SHOULDER_Y_OFFSET_FROM_COLLAR_END * baseUnitH})`}>
              <Bone 
                rotation={getRotation('r_shoulder')} 
                length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.UPPER_ARM, 'r_upper_arm', 'h')} 
                width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LIMB_WIDTH_ARM, 'r_upper_arm', 'w')} 
                variant="deltoid-shape" 
                showPivots={showPivots} 
                visible={true} 
                showLabel={showLabels}
                label="R.Bicep"
                boneKey="r_shoulder"
                proportionKey="r_upper_arm"
                onAnchorMouseDown={onAnchorMouseDown}
                isBeingDragged={draggingBoneKey === 'r_shoulder'}
                isPausedAndPivotsVisible={isPausedAndPivotsVisible}
                skeletal={skeletal}
              >
                <Bone 
                  rotation={getRotation('r_elbow')} 
                  length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LOWER_ARM, 'r_lower_arm', 'h')} 
                  width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LIMB_WIDTH_FOREARM, 'r_lower_arm', 'w')} 
                  variant="limb-tapered" 
                  showPivots={showPivots} 
                  visible={true} 
                  showLabel={showLabels}
                  label="R.Forearm"
                  boneKey="r_elbow"
                  proportionKey="r_lower_arm"
                  onAnchorMouseDown={onAnchorMouseDown}
                  isBeingDragged={draggingBoneKey === 'r_elbow'}
                  isPausedAndPivotsVisible={isPausedAndPivotsVisible}
                  skeletal={skeletal}
                >
                  <Bone 
                    rotation={getRotation('r_hand')} 
                    length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.HAND, 'r_hand', 'h')} 
                    width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.HAND_WIDTH, 'r_hand', 'w')} 
                    variant="hand-foot-arrowhead-shape" 
                    showPivots={showPivots} 
                    visible={true} 
                    showLabel={showLabels}
                    label="R.Hand"
                    boneKey="r_hand"
                    proportionKey="r_hand"
                    onAnchorMouseDown={onAnchorMouseDown}
                    isBeingDragged={draggingBoneKey === 'r_hand'}
                    isPausedAndPivotsVisible={isPausedAndPivotsVisible}
                    skeletal={skeletal}
                  />
                </Bone>
              </Bone>
            </g>

            {/* LEFT ARM */}
            <g transform={`translate(${RIGGING.L_SHOULDER_X_OFFSET_FROM_COLLAR_CENTER * baseUnitH}, ${RIGGING.SHOULDER_Y_OFFSET_FROM_COLLAR_END * baseUnitH})`}>
              <Bone 
                rotation={getRotation('l_shoulder')} 
                length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.UPPER_ARM, 'l_upper_arm', 'h')} 
                width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LIMB_WIDTH_ARM, 'l_upper_arm', 'w')} 
                variant="deltoid-shape" 
                showPivots={showPivots} 
                visible={true} 
                showLabel={showLabels}
                label="L.Bicep"
                boneKey="l_shoulder"
                proportionKey="l_upper_arm"
                onAnchorMouseDown={onAnchorMouseDown}
                isBeingDragged={draggingBoneKey === 'l_shoulder'}
                isPausedAndPivotsVisible={isPausedAndPivotsVisible}
                skeletal={skeletal}
              >
                <Bone 
                  rotation={getRotation('l_elbow')} 
                  // FIX: Corrected typo in constant name.
                  length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LOWER_ARM, 'l_lower_arm', 'h')} 
                  width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LIMB_WIDTH_FOREARM, 'l_lower_arm', 'w')} 
                  variant="limb-tapered" 
                  showPivots={showPivots} 
                  visible={true} 
                  showLabel={showLabels}
                  label="L.Forearm"
                  boneKey="l_elbow"
                  proportionKey="l_lower_arm"
                  onAnchorMouseDown={onAnchorMouseDown}
                  isBeingDragged={draggingBoneKey === 'l_elbow'}
                  isPausedAndPivotsVisible={isPausedAndPivotsVisible}
                  skeletal={skeletal}
                >
                  <Bone 
                    rotation={getRotation('l_hand')} 
                    length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.HAND, 'l_hand', 'h')} 
                    width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.HAND_WIDTH, 'l_hand', 'w')} 
                    variant="hand-foot-arrowhead-shape" 
                    showPivots={showPivots} 
                    visible={true} 
                    showLabel={showLabels}
                    label="L.Hand"
                    boneKey="l_hand"
                    proportionKey="l_hand"
                    onAnchorMouseDown={onAnchorMouseDown}
                    isBeingDragged={draggingBoneKey === 'l_hand'}
                    isPausedAndPivotsVisible={isPausedAndPivotsVisible}
                    skeletal={skeletal}
                  />
                </Bone>
              </Bone>
            </g>
          </Bone>
        </Bone>
      </Bone>
      
      {/* LEGS (attached at the same conceptual root as Waist) */}
      <g>
        <Bone 
          rotation={getRotation('l_hip')} 
          length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LEG_UPPER, 'l_upper_leg', 'h')} 
          width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LIMB_WIDTH_THIGH, 'l_upper_leg', 'w')} 
          variant="limb-tapered" 
          showPivots={showPivots} 
          visible={true} 
          showLabel={showLabels}
          label="L.Thigh"
          boneKey="l_hip"
          proportionKey="l_upper_leg"
          onAnchorMouseDown={onAnchorMouseDown}
          isBeingDragged={draggingBoneKey === 'l_hip'}
          isPausedAndPivotsVisible={isPausedAndPivotsVisible}
          skeletal={skeletal}
        >
          <Bone 
            rotation={getRotation('l_knee')} 
            length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LEG_LOWER, 'l_lower_leg', 'h')} 
            width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LIMB_WIDTH_CALF, 'l_lower_leg', 'w')} 
            variant="limb-tapered" 
            showPivots={showPivots} 
            visible={true} 
            showLabel={showLabels}
            label="L.Calf"
            boneKey="l_knee"
            proportionKey="l_lower_leg"
            onAnchorMouseDown={onAnchorMouseDown}
            isBeingDragged={draggingBoneKey === 'l_knee'}
            isPausedAndPivotsVisible={isPausedAndPivotsVisible}
            skeletal={skeletal}
          >
            <Bone 
              rotation={getRotation('l_foot')} 
              length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.FOOT, 'l_foot', 'h')} 
              width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.FOOT_WIDTH, 'l_foot', 'w')} 
              variant="foot-block-shape"
              showPivots={showPivots} 
              visible={true} 
              showLabel={showLabels}
              label="L.Foot"
              boneKey="l_foot"
              proportionKey="l_foot"
              onAnchorMouseDown={onAnchorMouseDown}
              isBeingDragged={draggingBoneKey === 'l_foot'}
              isPausedAndPivotsVisible={isPausedAndPivotsVisible}
              skeletal={skeletal}
            >
              <Bone 
                rotation={getRotation('l_toe')} 
                length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.TOE, 'l_toe', 'h')} 
                width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.TOE_WIDTH, 'l_toe', 'w')} 
                variant="hand-foot-arrowhead-shape" 
                showPivots={showPivots} 
                visible={true} 
                showLabel={showLabels}
                label="L.Toe"
                boneKey="l_toe"
                proportionKey="l_toe"
                onAnchorMouseDown={onAnchorMouseDown}
                isBeingDragged={draggingBoneKey === 'l_toe'}
                isPausedAndPivotsVisible={isPausedAndPivotsVisible}
                skeletal={skeletal}
              />
            </Bone>
          </Bone>
        </Bone>
      </g>

      <g>
        <Bone 
          rotation={getRotation('r_hip')} 
          length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LEG_UPPER, 'r_upper_leg', 'h')} 
          width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LIMB_WIDTH_THIGH, 'r_upper_leg', 'w')} 
          variant="limb-tapered" 
          showPivots={showPivots} 
          visible={true} 
          showLabel={showLabels}
          label="R.Thigh"
          boneKey="r_hip"
          proportionKey="r_upper_leg"
          onAnchorMouseDown={onAnchorMouseDown}
          isBeingDragged={draggingBoneKey === 'r_hip'}
          isPausedAndPivotsVisible={isPausedAndPivotsVisible}
          skeletal={skeletal}
        >
          <Bone 
            rotation={getRotation('r_knee')} 
            length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LEG_LOWER, 'r_lower_leg', 'h')} 
            width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LIMB_WIDTH_CALF, 'r_lower_leg', 'w')} 
            variant="limb-tapered" 
            showPivots={showPivots} 
            visible={true} 
            showLabel={showLabels}
            label="R.Calf"
            boneKey="r_knee"
            proportionKey="r_lower_leg"
            onAnchorMouseDown={onAnchorMouseDown}
            isBeingDragged={draggingBoneKey === 'r_knee'}
            isPausedAndPivotsVisible={isPausedAndPivotsVisible}
            skeletal={skeletal}
          >
            <Bone 
              rotation={getRotation('r_foot')} 
              length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.FOOT, 'r_foot', 'h')} 
              width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.FOOT_WIDTH, 'r_foot', 'w')} 
              variant="foot-block-shape"
              showPivots={showPivots} 
              visible={true} 
              showLabel={showLabels}
              label="R.Foot"
              boneKey="r_foot"
              proportionKey="r_foot"
              onAnchorMouseDown={onAnchorMouseDown}
              isBeingDragged={draggingBoneKey === 'r_foot'}
              isPausedAndPivotsVisible={isPausedAndPivotsVisible}
              skeletal={skeletal}
            >
              <Bone 
                rotation={getRotation('r_toe')} 
                length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.TOE, 'r_toe', 'h')} 
                width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.TOE_WIDTH, 'r_toe', 'w')} 
                variant="hand-foot-arrowhead-shape" 
                showPivots={showPivots} 
                visible={true} 
                showLabel={showLabels}
                label="R.Toe"
                boneKey="r_toe"
                proportionKey="r_toe"
                onAnchorMouseDown={onAnchorMouseDown}
                isBeingDragged={draggingBoneKey === 'r_toe'}
                isPausedAndPivotsVisible={isPausedAndPivotsVisible}
                skeletal={skeletal}
              />
            </Bone>
          </Bone>
        </Bone>
      </g>
    </g>
  );
};
