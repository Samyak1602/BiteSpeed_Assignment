import express from 'express';
import type { Request, Response } from 'express';

const app = express();
app.use(express.json());

import { PrismaClient } from '@prisma/client';
import type { Contact } from '@prisma/client';

const prisma = new PrismaClient();

app.post('/identify', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({ error: 'Email or phoneNumber is required' });
    }

    // 1. Query: Find all contacts matching the given email OR phoneNumber
    const matchingContacts = await prisma.contact.findMany({
      where: {
        OR: [
          { email: email || undefined },
          { phoneNumber: phoneNumber || undefined }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    // 2. Case A (No matches): Create a new Contact and return it
    if (matchingContacts.length === 0) {
      const newContact = await prisma.contact.create({
        data: {
          email: email || null,
          phoneNumber: phoneNumber || null,
          linkPrecedence: 'primary'
        }
      });

      return res.status(200).json({
        contact: {
          primaryContatctId: newContact.id,
          emails: newContact.email ? [newContact.email] : [],
          phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
          secondaryContactIds: []
        }
      });
    }

    // 3. Case B (Matches found): Find the entire cluster
    // First, find all primary contacts from the initial matches
    const primaryContactIds = new Set<number>();
    for (const contact of matchingContacts) {
      if (contact.linkPrecedence === 'primary') {
        primaryContactIds.add(contact.id);
      } else if (contact.linkedId !== null) {
        primaryContactIds.add(contact.linkedId);
      }
    }

    // Now fetch the actual primary contacts to find the oldest one
    const primaryContacts = await prisma.contact.findMany({
      where: { id: { in: Array.from(primaryContactIds) } },
      orderBy: { createdAt: 'asc' }
    });

    const oldestPrimary = primaryContacts[0];
    if (!oldestPrimary) {
      return res.status(500).json({ error: 'Internal server error: oldestPrimary could not be found' });
    }
    const otherPrimaries = primaryContacts.slice(1);

    // Sub-case B1: Merge other primaries into the oldest primary
    if (otherPrimaries.length > 0) {
      const otherPrimaryIds = otherPrimaries.map((p: Contact) => p.id);

      // Update the other primaries to be secondary
      await prisma.contact.updateMany({
        where: { id: { in: otherPrimaryIds } },
        data: {
          linkedId: oldestPrimary.id,
          linkPrecedence: 'secondary',
          updatedAt: new Date()
        }
      });

      // Update any existing secondaries of the newer primaries to point to the oldest primary
      await prisma.contact.updateMany({
        where: { linkedId: { in: otherPrimaryIds } },
        data: {
          linkedId: oldestPrimary.id,
          updatedAt: new Date()
        }
      });
    }

    // Fetch the ENTIRE updated cluster (the oldest primary + all its secondaries)
    const clusterContacts = await prisma.contact.findMany({
      where: {
        OR: [
          { id: oldestPrimary.id },
          { linkedId: oldestPrimary.id }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    // Sub-case B2: Check if there's new information (email or phone)
    let newContactCreated = false;
    const clusterEmails = new Set(clusterContacts.map((c: Contact) => c.email).filter(Boolean));
    const clusterPhones = new Set(clusterContacts.map((c: Contact) => c.phoneNumber).filter(Boolean));

    const hasNewEmail = email && !clusterEmails.has(email);
    const hasNewPhone = phoneNumber && !clusterPhones.has(phoneNumber);

    if (hasNewEmail || hasNewPhone) {
      const newSecondary = await prisma.contact.create({
        data: {
          email: email || null,
          phoneNumber: phoneNumber || null,
          linkedId: oldestPrimary.id,
          linkPrecedence: 'secondary'
        }
      });
      clusterContacts.push(newSecondary);
      newContactCreated = true;
    }

    // 4. Response Formatting
    const finalEmails = new Set<string>();
    const finalPhones = new Set<string>();
    const secondaryContactIds: number[] = [];

    // Process primary first to ensure they are at the beginning of the arrays
    if (oldestPrimary.email) finalEmails.add(oldestPrimary.email);
    if (oldestPrimary.phoneNumber) finalPhones.add(oldestPrimary.phoneNumber);

    // Process all other contacts in the cluster
    for (const contact of clusterContacts) {
      if (contact.id !== oldestPrimary.id) {
        secondaryContactIds.push(contact.id);
      }
      if (contact.email) finalEmails.add(contact.email);
      if (contact.phoneNumber) finalPhones.add(contact.phoneNumber);
    }

    return res.status(200).json({
      contact: {
        primaryContatctId: oldestPrimary.id,
        emails: Array.from(finalEmails),
        phoneNumbers: Array.from(finalPhones),
        secondaryContactIds: secondaryContactIds
      }
    });

  } catch (error) {
    console.error('Error in /identify:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
