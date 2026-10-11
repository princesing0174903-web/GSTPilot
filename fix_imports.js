const fs = require('fs');
let code = fs.readFileSync('src/components/auth/LoginPage.tsx', 'utf8');

// Replace the imports with the correct ones
const oldImports = `import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { BrandLogo } from '@/components/BrandLogo';
import { Eye, EyeOff, AlertTriangle, ArrowLeft } from 'lucide-react';`;

const newImports = `'use client';

import React, { useState } from 'react';
import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';`;

code = code.replace(oldImports, newImports);

// Also fix the props interface
const oldInterface = `interface LoginPageProps {
  onBack: () => void;
  onGetStarted: () => void;
}`;

const newInterface = `interface LoginPageProps {
  onBack?: () => void;
  onGetStarted?: () => void;
}`;

code = code.replace(oldInterface, newInterface);

fs.writeFileSync('src/components/auth/LoginPage.tsx', code, 'utf8');
