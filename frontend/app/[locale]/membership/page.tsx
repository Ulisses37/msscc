'use client';

import React from 'react';
import Button from '@/components/ui/Button';

export default function MembershipPage() {

  const handleDownload = async () => {
    try {
      // 1. Fetch the list from the API 
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/media/`);
      if (!response.ok) throw new Error('Failed to fetch media list');
      const items = await response.json();
      
      // 2. Find the specific membership form item
      const formItem = items.find((item: any) => item.file_name === "Printable_Membership_Form.pdf");
      if (!formItem || !formItem.file_url) {
        alert("Membership form not found on the server.");
        return;
      }

      // 3. Trigger the download using the URL from the database
      const fileResponse = await fetch(formItem.file_url);
      const blob = await fileResponse.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Membership_Form.pdf'); 
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error("Download failed:", error);
    } 
  };

  return (
    <div>
      <h1>Membership Page</h1>
      {/* text elements to be added later */}

      {/* Test Button / Placeholder button */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <Button text="View Event →" padding="6px 10px" onClick= {() => console.log('Button clicked!')}/>
        <Button text="REALLLLLLY LOONNGGGG TEXTTTTTT" width="103px" height="86px"/>
      </div>
      
      {/* Printable Membership Form Button */}
        <div style={{ textAlign: 'center' }}>
          <Button 
            text="Print Membership Form" 
            padding="12px 24px"
            fontSize="16px"
            onClick={handleDownload}
          />
        </div>

        {/* Payment interface to be implemented later */}
    </div>
    
  );
}
