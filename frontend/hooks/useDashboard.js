'use client';

// Dashboard hook — returns role-appropriate aggregated stats and lists
// derived from the mock data set.

import { useState, useEffect, useMemo } from 'react';
import {
  professionals,
  firms,
  clients,
  cases,
  bookings,
  consultations,
  reviews,
} from '@/data/mockData';
import { ROLES } from '@/utils/constants';

function sum(list, key) {
  return list.reduce((total, item) => total + (Number(item[key]) || 0), 0);
}

function buildClientDashboard(linkedId) {
  const myBookings = linkedId
    ? bookings.filter((b) => b.clientId === linkedId)
    : bookings;
  const myCases = linkedId
    ? cases.filter((c) => c.clientId === linkedId)
    : cases;
  const myConsultations = linkedId
    ? consultations.filter((c) => c.clientId === linkedId)
    : consultations;

  return {
    stats: {
      totalBookings: myBookings.length,
      upcomingBookings: myBookings.filter(
        (b) => b.status === 'confirmed' || b.status === 'pending'
      ).length,
      activeCases: myCases.filter((c) => c.status !== 'closed').length,
      completedConsultations: myConsultations.filter(
        (c) => c.callStatus === 'ended'
      ).length,
      totalSpent: sum(
        myBookings.filter((b) => b.status === 'completed'),
        'estimatedCost'
      ),
    },
    bookings: myBookings,
    cases: myCases,
    consultations: myConsultations,
  };
}

function buildProfessionalDashboard(linkedId) {
  const myBookings = linkedId
    ? bookings.filter((b) => b.professionalId === linkedId)
    : bookings;
  const myCases = linkedId
    ? cases.filter((c) => c.professionalId === linkedId)
    : cases;
  const myConsultations = linkedId
    ? consultations.filter((c) => c.professionalId === linkedId)
    : consultations;
  const myReviews = linkedId
    ? reviews.filter((r) => r.professionalId === linkedId)
    : reviews;
  const avgRating = myReviews.length
    ? Math.round((sum(myReviews, 'rating') / myReviews.length) * 10) / 10
    : 0;

  return {
    stats: {
      totalBookings: myBookings.length,
      pendingBookings: myBookings.filter((b) => b.status === 'pending').length,
      activeCases: myCases.filter((c) => c.status !== 'closed').length,
      completedConsultations: myConsultations.filter(
        (c) => c.callStatus === 'ended'
      ).length,
      totalEarnings: sum(
        myBookings.filter((b) => b.status === 'completed'),
        'estimatedCost'
      ),
      averageRating: avgRating,
      reviewsCount: myReviews.length,
    },
    bookings: myBookings,
    cases: myCases,
    consultations: myConsultations,
    reviews: myReviews,
  };
}

function buildFirmDashboard(firmId) {
  const firm = firmId ? firms.find((f) => f.id === firmId) : firms[0];
  const firmProfessionals = firm
    ? professionals.filter((p) => p.firmId === firm.id)
    : professionals;
  const proIds = firmProfessionals.map((p) => p.id);
  const firmCases = cases.filter(
    (c) => c.firmId === (firm && firm.id) || proIds.includes(c.professionalId)
  );
  const firmBookings = bookings.filter((b) =>
    proIds.includes(b.professionalId)
  );

  return {
    firm,
    stats: {
      totalProfessionals: firmProfessionals.length,
      totalCases: firmCases.length,
      activeCases: firmCases.filter((c) => c.status !== 'closed').length,
      totalBookings: firmBookings.length,
      revenue: sum(
        firmBookings.filter((b) => b.status === 'completed'),
        'estimatedCost'
      ),
      averageRating: firm ? firm.rating : 0,
    },
    professionals: firmProfessionals,
    cases: firmCases,
    bookings: firmBookings,
  };
}

function buildPlatformDashboard() {
  return {
    stats: {
      totalProfessionals: professionals.length,
      pendingApprovals: professionals.filter((p) => p.status === 'pending')
        .length,
      totalFirms: firms.length,
      totalClients: clients.length,
      totalBookings: bookings.length,
      totalCases: cases.length,
      totalConsultations: consultations.length,
      platformRevenue: sum(
        bookings.filter((b) => b.status === 'completed'),
        'estimatedCost'
      ),
    },
    professionals,
    firms,
    clients,
    bookings,
    cases,
    consultations,
    pendingProfessionals: professionals.filter((p) => p.status === 'pending'),
  };
}

/**
 * @param {string} role - one of ROLES values
 * @param {string} [linkedId] - id of the linked client/professional/firm
 */
export function useDashboard(role, linkedId) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 0);
    return () => clearTimeout(t);
  }, [role, linkedId]);

  const dashboard = useMemo(() => {
    switch (role) {
      case ROLES.PROFESSIONAL:
      case ROLES.FIRM_PROFESSIONAL:
        return buildProfessionalDashboard(linkedId);
      case ROLES.FIRM_ADMIN:
        return buildFirmDashboard(linkedId);
      case ROLES.PLATFORM_ADMIN:
        return buildPlatformDashboard();
      case ROLES.CLIENT:
      default:
        return buildClientDashboard(linkedId);
    }
  }, [role, linkedId]);

  return { loading, ...dashboard };
}

export default useDashboard;
