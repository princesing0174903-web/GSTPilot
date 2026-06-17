'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  PenTool,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Send,
  Download,
  Shield,
  User,
  Globe,
  Search,
  Archive,
  AlertTriangle,
  ChevronRight,
  Plus,
  Fingerprint,
  CalendarDays,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, differenceInHours, parseISO } from 'date-fns';

// ─── Types ─────────────────────────────────────────────────────────────────────

type SignatureStatus = 'sent' | 'viewed' | 'signed' | 'declined' | 'expired';

interface Signer {
  id: string;
  name: string;
  email: string;
  role: string;
  status: SignatureStatus;
  signedAt?: string;
  ipAddress?: string;
}

interface SignatureRequest {
  id: string;
  documentName: string;
  documentType: string;
  sentBy: string;
  sentAt: string;
  signers: Signer[];
  status: SignatureStatus;
  expiresAt: string;
  certificateInfo?: {
    issuer: string;
    serial: string;
    validFrom: string;
    validTo: string;
  };
}

// ─── Status Config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SignatureStatus, { label: string; color: string; icon: React.ReactNode }> = {
  sent: { label: 'Sent', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: <Send className="size-3.5" /> },
  viewed: { label: 'Viewed', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: <Eye className="size-3.5" /> },
  signed: { label: 'Signed', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="size-3.5" /> },
  declined: { label: 'Declined', color: 'text-red-700 bg-red-50 border-red-200', icon: <XCircle className="size-3.5" /> },
  expired: { label: 'Expired', color: 'text-slate-500 bg-slate-50 border-slate-200', icon: <Clock className="size-3.5" /> },
};

// ─── Mock Data ─────────────────────────────────────────────────────────────────

function generateMockSignatures(): SignatureRequest[] {
  return [
    {
      id: 'SIG-001',
      documentName: 'GSTR-1 Filing Authorization - Acme Industries',
      documentType: 'Filing Authorization',
      sentBy: 'Rajesh Kumar',
      sentAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      status: 'sent',
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      signers: [
        { id: 's1', name: 'Vikram Mehta', email: 'vikram@acme.com', role: 'Authorized Signatory', status: 'sent' },
        { id: 's2', name: 'Rajesh Kumar', email: 'rajesh@gstpilot.ai', role: 'CA', status: 'sent' },
      ],
    },
    {
      id: 'SIG-002',
      documentName: 'Engagement Letter - Sharma & Associates',
      documentType: 'Engagement Letter',
      sentBy: 'Priya Sharma',
      sentAt: new Date(Date.now() - 24 * 3600000).toISOString(),
      status: 'viewed',
      expiresAt: new Date(Date.now() + 6 * 86400000).toISOString(),
      signers: [
        { id: 's3', name: 'Sunil Sharma', email: 'sunil@sharma.com', role: 'Partner', status: 'viewed' },
        { id: 's4', name: 'Priya Sharma', email: 'priya@gstpilot.ai', role: 'CA', status: 'sent' },
      ],
    },
    {
      id: 'SIG-003',
      documentName: 'Tax Audit Report - FY 2023-24',
      documentType: 'Audit Report',
      sentBy: 'Rajesh Kumar',
      sentAt: new Date(Date.now() - 72 * 3600000).toISOString(),
      status: 'signed',
      expiresAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      signers: [
        { id: 's5', name: 'Anita Desai', email: 'anita@beta.com', role: 'Director', status: 'signed', signedAt: new Date(Date.now() - 48 * 3600000).toISOString(), ipAddress: '103.212.88.12' },
        { id: 's6', name: 'Rajesh Kumar', email: 'rajesh@gstpilot.ai', role: 'CA', status: 'signed', signedAt: new Date(Date.now() - 36 * 3600000).toISOString(), ipAddress: '192.168.1.45' },
      ],
      certificateInfo: {
        issuer: 'GSTPilot Digital CA',
        serial: 'CERT-2024-00847',
        validFrom: '2024-01-01',
        validTo: '2025-12-31',
      },
    },
    {
      id: 'SIG-004',
      documentName: 'Power of Attorney - Gamma Corp',
      documentType: 'POA',
      sentBy: 'Amit Patel',
      sentAt: new Date(Date.now() - 96 * 3600000).toISOString(),
      status: 'declined',
      expiresAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      signers: [
        { id: 's7', name: 'Deepak Rao', email: 'deepak@gamma.com', role: 'MD', status: 'declined' },
      ],
    },
    {
      id: 'SIG-005',
      documentName: 'GST Registration Application - Delta Ltd',
      documentType: 'Registration',
      sentBy: 'Priya Sharma',
      sentAt: new Date(Date.now() - 168 * 3600000).toISOString(),
      status: 'expired',
      expiresAt: new Date(Date.now() - 24 * 3600000).toISOString(),
      signers: [
        { id: 's8', name: 'Kavita Nair', email: 'kavita@delta.com', role: 'Director', status: 'expired' },
      ],
    },
  ];
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ESignaturesPage() {
  const [signatures] = useState<SignatureRequest[]>(() => generateMockSignatures());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [sendOpen, setSendOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSig, setSelectedSig] = useState<SignatureRequest | null>(null);
  const [newDocName, setNewDocName] = useState('');
  const [newDocType, setNewDocType] = useState('Filing Authorization');
  const [newSignerName, setNewSignerName] = useState('');
  const [newSignerEmail, setNewSignerEmail] = useState('');

  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const pendingSigs = useMemo(() =>
    signatures.filter((s) => s.status === 'sent' || s.status === 'viewed'),
  [signatures]);

  const signedSigs = useMemo(() =>
    signatures.filter((s) => s.status === 'signed'),
  [signatures]);

  const otherSigs = useMemo(() =>
    signatures.filter((s) => s.status === 'declined' || s.status === 'expired'),
  [signatures]);

  const displayList = activeTab === 'pending' ? pendingSigs : activeTab === 'signed' ? signedSigs : otherSigs;

  const handleViewDetail = (sig: SignatureRequest) => {
    setSelectedSig(sig);
    setDetailOpen(true);
  };

  const handleSendRequest = () => {
    // In production, this would call an API
    setSendOpen(false);
    setNewDocName('');
    setNewSignerName('');
    setNewSignerEmail('');
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
            <PenTool className="size-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">E-Signatures</h1>
            <p className="text-sm text-muted-foreground">Digital document signing and tracking</p>
          </div>
        </div>
        <Button onClick={() => setSendOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <Send className="size-4" />
          New Signature Request
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{pendingSigs.length}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <Clock className="size-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Signed</p>
                <p className="text-2xl font-bold">{signedSigs.length}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50">
                <CheckCircle2 className="size-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Declined</p>
                <p className="text-2xl font-bold">{otherSigs.filter(s => s.status === 'declined').length}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-red-50">
                <XCircle className="size-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{signatures.length}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-purple-50">
                <FileText className="size-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="size-4" />
            Pending ({pendingSigs.length})
          </TabsTrigger>
          <TabsTrigger value="signed" className="gap-2">
            <CheckCircle2 className="size-4" />
            Signed ({signedSigs.length})
          </TabsTrigger>
          <TabsTrigger value="archive" className="gap-2">
            <Archive className="size-4" />
            Archive ({otherSigs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-3 mt-4">
          <AnimatePresence>
            {displayList.map((sig) => {
              const statusCfg = STATUS_CONFIG[sig.status];
              const hoursAgo = differenceInHours(new Date(), parseISO(sig.sentAt));
              const allSigned = sig.signers.every((s) => s.status === 'signed');

              return (
                <motion.div
                  key={sig.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleViewDetail(sig)}>
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        {/* Left: Doc info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={`gap-1 text-xs ${statusCfg.color}`}>
                              {statusCfg.icon}
                              {statusCfg.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs text-slate-500">
                              {sig.documentType}
                            </Badge>
                          </div>
                          <h3 className="font-semibold mt-2 text-sm truncate">{sig.documentName}</h3>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="size-3" />
                              Sent by {sig.sentBy}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {hoursAgo}h ago
                            </span>
                          </div>
                        </div>

                        {/* Middle: Signer progress */}
                        <div className="flex items-center gap-2 shrink-0">
                          {sig.signers.map((signer, idx) => {
                            const sCfg = STATUS_CONFIG[signer.status];
                            return (
                              <React.Fragment key={signer.id}>
                                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs ${sCfg.color}`}>
                                  {sCfg.icon}
                                  <span>{signer.name.split(' ')[0]}</span>
                                </div>
                                {idx < sig.signers.length - 1 && (
                                  <ChevronRight className="size-3 text-muted-foreground" />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {allSigned && (
                            <Button variant="outline" size="sm" className="gap-1">
                              <Download className="size-3.5" />
                              Download
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewDetail(sig); }}>
                            <Eye className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {displayList.length === 0 && (
            <Card>
              <CardContent className="py-16">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <PenTool className="size-8 opacity-50" />
                  <p>No documents in this category</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4 text-emerald-600" />
              Signature Details
            </DialogTitle>
          </DialogHeader>
          {selectedSig && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-muted/30">
                <h3 className="font-semibold text-sm">{selectedSig.documentName}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={`gap-1 text-xs ${STATUS_CONFIG[selectedSig.status].color}`}>
                    {STATUS_CONFIG[selectedSig.status].icon}
                    {STATUS_CONFIG[selectedSig.status].label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{selectedSig.documentType}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Sent By</p>
                  <p>{selectedSig.sentBy}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sent At</p>
                  <p>{format(parseISO(selectedSig.sentAt), 'MMM d, yyyy h:mm a')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expires</p>
                  <p>{format(parseISO(selectedSig.expiresAt), 'MMM d, yyyy')}</p>
                </div>
              </div>

              <Separator />

              {/* Signer details */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Signer Progress</p>
                {selectedSig.signers.map((signer) => {
                  const sCfg = STATUS_CONFIG[signer.status];
                  return (
                    <div key={signer.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">
                          {signer.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{signer.name}</p>
                          <p className="text-xs text-muted-foreground">{signer.role} &middot; {signer.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className={`gap-1 text-xs ${sCfg.color}`}>
                          {sCfg.icon}
                          {sCfg.label}
                        </Badge>
                        {signer.signedAt && (
                          <span className="text-[10px] text-muted-foreground">
                            {format(parseISO(signer.signedAt), 'MMM d, h:mm a')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Signature Audit Trail */}
              {selectedSig.signers.some(s => s.status === 'signed') && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Shield className="size-4 text-emerald-600" />
                      Signature Audit Trail
                    </p>
                    {selectedSig.signers.filter(s => s.status === 'signed').map((signer) => (
                      <div key={signer.id} className="rounded-lg border bg-emerald-50/50 p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{signer.name}</span>
                          <span className="text-muted-foreground">{signer.signedAt ? format(parseISO(signer.signedAt), 'MMM d, yyyy h:mm:ss a') : ''}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Globe className="size-3" />
                          IP: {signer.ipAddress || 'N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Digital Certificate */}
              {selectedSig.certificateInfo && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Fingerprint className="size-4 text-emerald-600" />
                      Digital Certificate
                    </p>
                    <div className="rounded-lg border p-3 text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Issuer</span>
                        <span>{selectedSig.certificateInfo.issuer}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Serial</span>
                        <span className="font-mono">{selectedSig.certificateInfo.serial}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valid From</span>
                        <span>{selectedSig.certificateInfo.validFrom}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valid To</span>
                        <span>{selectedSig.certificateInfo.validTo}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Signature Request Dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="size-4 text-emerald-600" />
              New Signature Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Document Name</label>
              <Input
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                placeholder="e.g., GSTR-1 Authorization Letter"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Document Type</label>
              <Select value={newDocType} onValueChange={setNewDocType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Filing Authorization">Filing Authorization</SelectItem>
                  <SelectItem value="Engagement Letter">Engagement Letter</SelectItem>
                  <SelectItem value="Audit Report">Audit Report</SelectItem>
                  <SelectItem value="POA">Power of Attorney</SelectItem>
                  <SelectItem value="Registration">Registration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div>
              <label className="text-sm font-medium">Signer Name</label>
              <Input
                value={newSignerName}
                onChange={(e) => setNewSignerName(e.target.value)}
                placeholder="e.g., Vikram Mehta"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Signer Email</label>
              <Input
                value={newSignerEmail}
                onChange={(e) => setNewSignerEmail(e.target.value)}
                placeholder="e.g., vikram@company.com"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button onClick={handleSendRequest} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
              <Send className="size-4" />
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
