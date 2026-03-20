'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface TextTypeProps {
 text?: string[];
 texts?: string[];
 typingSpeed?: number;
 pauseDuration?: number;
 showCursor?: boolean;
 cursorCharacter?: string;
 deletingSpeed?: number;
 variableSpeedEnabled?: boolean;
 variableSpeedMin?: number;
 variableSpeedMax?: number;
 cursorBlinkDuration?: number;
 className?: string;
}

export default function TextType({
 text,
 texts,
 typingSpeed = 75,
 pauseDuration = 1500,
 showCursor = true,
 cursorCharacter = '_',
 deletingSpeed = 50,
 variableSpeedEnabled = false,
 variableSpeedMin = 60,
 variableSpeedMax = 120,
 cursorBlinkDuration = 0.5,
 className = '',
}: TextTypeProps) {
 const [displayText, setDisplayText] = useState('');
 const [currentIndex, setCurrentIndex] = useState(0);
 const [isDeleting, setIsDeleting] = useState(false);
 
 const allTexts = texts || text || [];
 
 useEffect(() => {
 if (!allTexts.length) return;

 let timeoutId: NodeJS.Timeout;
 const currentFullText = allTexts[currentIndex % allTexts.length];

 if (!isDeleting && displayText === currentFullText) {
 timeoutId = setTimeout(() => setIsDeleting(true), pauseDuration);
 return () => clearTimeout(timeoutId);
 }

 if (isDeleting && displayText === '') {
 setIsDeleting(false);
 setCurrentIndex((prev) => prev + 1);
 return;
 }

 const nextText = isDeleting
 ? currentFullText.substring(0, displayText.length - 1)
 : currentFullText.substring(0, displayText.length + 1);

 const baseSpeed = isDeleting ? deletingSpeed : typingSpeed;
 const actualSpeed = variableSpeedEnabled
 ? Math.floor(Math.random() * (variableSpeedMax - variableSpeedMin + 1)) + variableSpeedMin
 : baseSpeed;

 timeoutId = setTimeout(() => {
 setDisplayText(nextText);
 }, actualSpeed);

 return () => clearTimeout(timeoutId);
 }, [displayText, isDeleting, currentIndex, allTexts, typingSpeed, deletingSpeed, pauseDuration, variableSpeedEnabled, variableSpeedMin, variableSpeedMax]);

 return (
 <span className={className}>
 {displayText}
 {showCursor && (text?.length || texts?.length) ? (
 <span
 className="inline-block"
 style={{
 animation: `blink ${cursorBlinkDuration}s step-start infinite`,
 }}
 >
 {cursorCharacter}
 </span>
 ) : null}
 <style dangerouslySetInnerHTML={{__html: `
 @keyframes blink {
 50% { opacity: 0; }
 }
 `}} />
 </span>
 );
}
