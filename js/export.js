// Export functionality for calendar integration

const ExportManager = {
    // Generate ICS (iCalendar) format for calendar import
    generateICS(itinerary) {
        if (!itinerary || !itinerary.startDate || itinerary.days.length === 0) {
            throw new Error('Invalid itinerary data for export');
        }

        const startDate = new Date(itinerary.startDate);
        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Trip Planner//Trip Planner//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];

        itinerary.days.forEach((day, index) => {
            if (!day.location) return;

            const eventDate = new Date(startDate);
            eventDate.setDate(startDate.getDate() + index);
            
            const dateStr = this.formatICSDate(eventDate);
            const endDateStr = this.formatICSDate(new Date(eventDate.getTime() + 24 * 60 * 60 * 1000));
            
            const eventId = `trip-${itinerary.id}-day-${index}@tripplanner.local`;
            
            let summary = `${itinerary.name} - ${day.location}`;
            let description = `Day ${index + 1} of ${itinerary.name}`;
            
            if (day.drivingTimeFromPrevious > 0) {
                description += `\\nDriving time from previous location: ${formatDrivingTime(day.drivingTimeFromPrevious)}`;
            }

            icsContent.push(
                'BEGIN:VEVENT',
                `UID:${eventId}`,
                `DTSTART;VALUE=DATE:${dateStr}`,
                `DTEND;VALUE=DATE:${endDateStr}`,
                `SUMMARY:${summary}`,
                `DESCRIPTION:${description}`,
                `LOCATION:${day.location}`,
                `DTSTAMP:${this.formatICSDateTime(new Date())}`,
                'TRANSP:TRANSPARENT',
                'END:VEVENT'
            );
        });

        icsContent.push('END:VCALENDAR');
        return icsContent.join('\r\n');
    },

    formatICSDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    },

    formatICSDateTime(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
    },

    downloadICS(itinerary) {
        try {
            const icsContent = this.generateICS(itinerary);
            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${itinerary.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
            link.click();
            
            URL.revokeObjectURL(link.href);
        } catch (error) {
            alert('Failed to export itinerary: ' + error.message);
        }
    },

    // Generate a text summary for copying/sharing
    generateTextSummary(itinerary) {
        if (!itinerary) return '';

        let summary = [`${itinerary.name}\n${'='.repeat(itinerary.name.length)}\n`];
        
        if (itinerary.startDate && itinerary.endDate) {
            summary.push(`Dates: ${itinerary.startDate} to ${itinerary.endDate}`);
        }
        
        summary.push(`Total nights: ${itinerary.getTotalNights()}`);
        summary.push(`Total driving time: ${formatDrivingTime(itinerary.totalDrivingTime)}\n`);
        
        summary.push('Itinerary:');
        itinerary.days.forEach((day, index) => {
            const dayLabel = getDayName(itinerary.startDate, index);
            summary.push(`  ${dayLabel}: ${day.location || 'TBD'}`);
            
            if (day.drivingTimeFromPrevious > 0) {
                summary.push(`    (${formatDrivingTime(day.drivingTimeFromPrevious)} drive)`);
            }
        });

        return summary.join('\n');
    },

    copyTextSummary(itinerary) {
        const summary = this.generateTextSummary(itinerary);
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(summary)
                .then(() => alert('Itinerary summary copied to clipboard!'))
                .catch(() => this.fallbackCopyText(summary));
        } else {
            this.fallbackCopyText(summary);
        }
    },

    fallbackCopyText(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            alert('Itinerary summary copied to clipboard!');
        } catch (err) {
            alert('Failed to copy to clipboard. Please copy the text manually from the popup.');
            prompt('Copy this text:', text);
        }
        
        document.body.removeChild(textArea);
    }
};
