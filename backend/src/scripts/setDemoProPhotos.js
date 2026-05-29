// Assign profilePhoto URLs to a subset of the seeded demo professionals.
//
// Uses i.pravatar.cc — a free placeholder service that serves real-photo
// headshots from a small pool (~70 images). The pool is NOT specifically
// Indian; some of the assignments will look South Asian, others will not.
// That trade-off was accepted in lieu of needing a paid generated-photos
// API or manual photo curation.
//
// To swap to your own curated photos later, just update PHOTO_MAP below.

require('dotenv').config();

const { User, sequelize } = require('../models');
const { Op } = require('sequelize');

// 11 of 18 — a believable mix of avatar styles on the listing.
// The right-hand value is the pravatar image id (1..70). Picking distinct
// ids per name keeps the listing from showing duplicates.
const PHOTO_MAP = {
  'aarav.mehta.demo@profirmo.seed':       { sex: 'M', img: 12 },
  'priya.sharma.demo@profirmo.seed':      { sex: 'F', img: 47 },
  'rohan.iyer.demo@profirmo.seed':        { sex: 'M', img: 60 },
  'ananya.reddy.demo@profirmo.seed':      { sex: 'F', img: 25 },
  'vikram.bhattacharya.demo@profirmo.seed': { sex: 'M', img: 33 },
  'sneha.pillai.demo@profirmo.seed':      { sex: 'F', img: 49 },
  'karan.malhotra.demo@profirmo.seed':    { sex: 'M', img: 53 },
  'pooja.agarwal.demo@profirmo.seed':     { sex: 'F', img: 32 },
  'saurabh.patel.demo@profirmo.seed':     { sex: 'M', img: 51 },
  'meera.nair.demo@profirmo.seed':        { sex: 'F', img: 5  },
  'devansh.trivedi.demo@profirmo.seed':   { sex: 'M', img: 68 },
  // The remaining seven keep their ui-avatars initials avatars:
  //   nikhil.joshi, arjun.singh, ritu.kapoor, isha.chatterjee,
  //   harsh.verma, tanvi.deshpande, aditya.rao
};

// i.pravatar.cc serves a fixed-image-by-id URL. 300x300 is plenty for the
// listing card + the detail-page header. `u` is unused here (we use `img`
// for stable assignment).
const photoUrl = (img) => `https://i.pravatar.cc/300?img=${img}`;

async function run() {
  await sequelize.authenticate();
  console.log('[demoPhotos] DB connected.');

  let updated = 0;
  let missing = 0;

  for (const [email, { img }] of Object.entries(PHOTO_MAP)) {
    const url = photoUrl(img);
    const [count] = await User.update(
      { profilePhoto: url },
      { where: { email } }
    );
    if (count > 0) {
      console.log(`[demoPhotos] ${email.padEnd(42)} -> img=${String(img).padEnd(2)} (${url})`);
      updated += 1;
    } else {
      console.warn(`[demoPhotos] no row for ${email}`);
      missing += 1;
    }
  }

  // Sanity: count how many demo rows now have a pravatar URL.
  const [withPhoto] = await sequelize.query(
    "SELECT COUNT(*) AS n FROM users WHERE email LIKE '%.demo@profirmo.seed' AND profilePhoto LIKE 'https://i.pravatar.cc%'"
  );
  const [withInitials] = await sequelize.query(
    "SELECT COUNT(*) AS n FROM users WHERE email LIKE '%.demo@profirmo.seed' AND profilePhoto LIKE 'https://ui-avatars.com%'"
  );

  console.log(`\n[demoPhotos] done. updated=${updated} missing=${missing}`);
  console.log(`[demoPhotos] demo rows with pravatar photos: ${withPhoto[0].n}`);
  console.log(`[demoPhotos] demo rows still on initials avatar: ${withInitials[0].n}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[demoPhotos] failed:', err);
    process.exit(1);
  });
