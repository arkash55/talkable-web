'use client';
import ConversationSidebar from '../components/home/ConversationSideBar';
import VoiceGrid from '../components/home/VoiceGrid';

export default function HomePage() {
  return (
<div style={{ 
height: '100%', width: '100%', display: 'flex', flexDirection: 'row'
}}>
      <VoiceGrid

        blocks={[
          { label: 'Priority 1: Most Likely Response', onClick: () => { alert('clicked priority 1')} },
          { label: 'Priority 2', onClick: () => {alert("clicked priority 2")} },
          { label: 'Priority 3', onClick: () => {alert("clicked priority 3")} },
          { label: 'Priority 4', onClick: () => {alert("clicked priority 4")} },
          { label: 'Priority 5', onClick: () => {alert("clicked priority 5")} },
          { label: 'Priority 6', onClick: () => {alert("clicked priority 6")} },
        ]}
      />
        <ConversationSidebar />
    </div>
  );
}
