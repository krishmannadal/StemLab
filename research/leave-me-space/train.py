"""Reproducible prototype training; synthetic labels are NOT real musical preferences.
Optional --data dataset.json: list of {song_id, split: train|validation|test,
features: [[lead_active, backing_energy, beat_sin, beat_cos, relative_time], ...],
targets: [[onset_suitability, preferred_length_in_8_half_beats, intensity], ...]}.
Real data must be annotated independently; no song may cross splits.
"""
import argparse, json, pathlib, random
import numpy as np
import torch
from torch import nn
p=argparse.ArgumentParser();p.add_argument('--data');p.add_argument('--epochs',type=int,default=100);args=p.parse_args()
torch.set_num_threads(2);torch.manual_seed(41);np.random.seed(41);random.seed(41)
root=pathlib.Path(__file__).resolve().parents[2]
class Planner(nn.Module):
 def __init__(self):
  super().__init__();self.gru=nn.GRU(5,12,batch_first=True,bidirectional=True);self.head=nn.Linear(24,3)
 def forward(self,x):return torch.sigmoid(self.head(self.gru(x)[0]))
def synthetic(seed):
 r=np.random.default_rng(seed);n=96;mask=np.zeros(n);pos=0
 while pos<n:
  gap=int(r.integers(2,18));pos+=gap;length=int(r.integers(3,22));mask[pos:min(n,pos+length)]=1;pos+=length
 bg=np.clip(np.cumsum(r.normal(0,.06,n))+.5,0,1);phase=r.uniform(0,4);x=[];y=[]
 for i in range(n):
  x.append([mask[i],bg[i],np.sin((i+.5-phase)*np.pi/4),np.cos((i+.5-phase)*np.pi/4),i/(n-1)])
  remaining=0
  for j in range(i,n):
   if mask[j]:break
   remaining+=1
  previous=next((i-j for j in range(i-1,-1,-1) if mask[j]),20)
  suitability=0 if remaining<2 else np.clip(.9-.025*previous-.15*bg[i],.1,.95)
  y.append([suitability,min(8,remaining)/8,.4+.4*(1-bg[i])])
 return {'song_id':f'synthetic-{seed}','features':x,'targets':y}
if args.data:
 records=json.loads(pathlib.Path(args.data).read_text());groups={}
 for rec in records:
  sid=rec['song_id'];split=rec['split'];assert split in ('train','validation','test')
  assert sid not in groups or groups[sid]==split,'Song leakage across splits';groups[sid]=split
  assert len(rec['features'])==len(rec['targets']) and len(rec['features'])>0
  assert np.asarray(rec['features']).shape[1]==5 and np.asarray(rec['targets']).shape[1]==3
  assert np.isfinite(rec['features']).all() and np.isfinite(rec['targets']).all()
  assert np.min(rec['targets'])>=0 and np.max(rec['targets'])<=1
 training='User supplied annotated dataset; inspect provenance before publication'
else:
 records=[dict(synthetic(i),split='train' if i<800 else 'validation' if i<900 else 'test') for i in range(1000)]
 training='Synthetic phrase masks only; experimental, not validated on real music'
splits={s:[r for r in records if r['split']==s] for s in ('train','validation','test')}
assert all(splits.values()),'All three splits are required'
def loss_for(model,records,train=False):
 losses=[]
 # Bucket identical lengths to avoid padding-induced recurrent state contamination.
 by_length={}
 for r in records:by_length.setdefault(len(r['features']),[]).append(r)
 for bucket in by_length.values():
  if train:random.shuffle(bucket)
  for start in range(0,len(bucket),64):
   batch=bucket[start:start+64];x=torch.tensor([r['features'] for r in batch],dtype=torch.float32);y=torch.tensor([r['targets'] for r in batch],dtype=torch.float32)
   pred=model(x);loss=((pred-y)**2).mean()
   if train:optimizer.zero_grad();loss.backward();nn.utils.clip_grad_norm_(model.parameters(),1);optimizer.step()
   losses.append((float(loss.detach()),len(batch)))
 return sum(a*b for a,b in losses)/sum(b for _,b in losses)
model=Planner();optimizer=torch.optim.Adam(model.parameters(),lr=.008);history=[];best=float('inf');state=None
for epoch in range(args.epochs):
 model.train();train=loss_for(model,splits['train'],True);model.eval()
 with torch.no_grad():val=loss_for(model,splits['validation'])
 history.append({'epoch':epoch+1,'train_mse':train,'validation_mse':val})
 if val<best:best=val;state={k:v.detach().clone() for k,v in model.state_dict().items()};best_epoch=epoch+1
model.load_state_dict(state)
with torch.no_grad():test=loss_for(model,splits['test']);parity=model(torch.tensor([splits['test'][0]['features']],dtype=torch.float32))[0].tolist()
weights={'version':'lms-bigru-12-v1','architecture':'Bidirectional GRU, 12 hidden units per direction, 3 sigmoid heads','hidden':12,'training':training,'state':{k:v.tolist() for k,v in state.items()}}
(root/'web/src/phrase-planner-weights.json').write_text(json.dumps(weights,separators=(',',':'))+'\n')
report={'seed':41,'torch':torch.__version__,'training':training,'records':{k:len(v) for k,v in splits.items()},'parameters':sum(p.numel() for p in model.parameters()),'selected_epoch':best_epoch,'test_mse':test,'history':history,'warning':'Synthetic regression metrics do not establish musical quality or superiority over a heuristic.'}
(root/'research/leave-me-space/training-report.json').write_text(json.dumps(report,indent=2)+'\n')
(root/'research/leave-me-space/parity.json').write_text(json.dumps({'features':splits['test'][0]['features'],'predictions':parity})+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='history'},indent=2))
