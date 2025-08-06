'use client';

import ConversationSidebar from '@/app/components/home/ConversationSideBar';
import VoiceControlBar from '@/app/components/home/VoiceControlBar';
import VoiceGrid from '@/app/components/home/VoiceGrid';
import { useState } from 'react';

export default function HomeClient() {
  const [aiResponses, setAiResponses] = useState<string[]>([]);

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'row' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <VoiceControlBar onResponses={setAiResponses} />

        <VoiceGrid
          blocks={[
            { label: aiResponses[0] || 'Priority 1: Most Likely', onClick: () => alert('clicked 1') },
            { label: aiResponses[1] || 'Priority 2', onClick: () => alert('clicked 2') },
            { label: aiResponses[2] || 'Priority 3', onClick: () => alert('clicked 3') },
            { label: aiResponses[3] || 'Priority 4', onClick: () => alert('clicked 4') },
            { label: aiResponses[4] || 'Priority 5', onClick: () => alert('clicked 5') },
            { label: aiResponses[5] || 'Priority 6', onClick: () => alert('clicked 6') },
          ]}
        />
      </div>

      <ConversationSidebar />
    </div>
  );
}




// export default function HomePage() {
//   return (
//   <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'row'}}>
  
//     <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
//         <VoiceControlBar />
//       <VoiceGrid

//         blocks={[
//           { label: 'Priority 1: Most Likely Response', onClick: () => { alert('clicked priority 1')} },
//           { label: 'Priority 2', onClick: () => {alert("clicked priority 2")} },
//           { label: 'Priority 3', onClick: () => {alert("clicked priority 3")} },
//           { label: 'Priority 4', onClick: () => {alert("clicked priority 4")} },
//           { label: 'Priority 5', onClick: () => {alert("clicked priority 5")} },
//           { label: 'Priority 6', onClick: () => {alert("clicked priority 6")} },
//         ]}
//       />
//       </div>
//         <ConversationSidebar />
//     </div>
//   );
// }
