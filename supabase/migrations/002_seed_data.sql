-- Seed data using real Supabase auth UUIDs
-- user-001 = Jamie  = bc668087-f272-44b7-9a58-00d36a31be93
-- user-002 = Maria  = 3b6e23ce-2a48-41a6-b51a-5d6625c28d26
-- user-003 = Alex   = cd4deb82-d7cc-46b3-b015-ba81e3d6034a
-- user-004 = Priya  = 2b1d31a1-0348-484e-900b-5c3dc16f5b1c
-- user-005 = Jordan = b7cc2650-df36-45f8-a920-9428089edbf9
-- user-006 = Sam    = 8bf44cdb-55f5-4fdd-a048-eb0055fda110
-- user-007 = Nina   = b4061c2d-7c98-4ddd-a086-95e12ec61e20
-- user-008 = Dave   = 6daf679c-395c-4f64-a956-a71e72b08096

-- ── Users ─────────────────────────────────────────────────────────────────────
INSERT INTO public.users (id, username, display_name, avatar_url, bio, neighborhood, interests, reputation_score, trade_count, joined_at) VALUES
('bc668087-f272-44b7-9a58-00d36a31be93','jamie_oak','Jamie Oakley','https://picsum.photos/seed/jamie/200/200','Avid gardener and furniture restorer. Always looking for good tools and interesting plants.','Downtown Memphis',ARRAY['gardening tools','kitchen appliances','books'],4.8,23,'2025-08-15T10:00:00Z'),
('3b6e23ce-2a48-41a6-b51a-5d6625c28d26','maria_s','Maria Santos','https://picsum.photos/seed/maria/200/200','Retired teacher offering tutoring in math and science. Love homemade food trades!','Midtown',ARRAY['homemade food','household items','kids books'],4.9,41,'2025-06-01T10:00:00Z'),
('cd4deb82-d7cc-46b3-b015-ba81e3d6034a','alex_builds','Alex Chen','https://picsum.photos/seed/alex/200/200','Handyman by trade, woodworker by passion. Can fix almost anything.','Cooper-Young',ARRAY['electronics','power tools','sports equipment'],4.7,15,'2025-09-20T10:00:00Z'),
('2b1d31a1-0348-484e-900b-5c3dc16f5b1c','priya_green','Priya Patel','https://picsum.photos/seed/priya/200/200','Plant mom with too many succulents. Also into pottery and weekend baking.','Germantown',ARRAY['planters','baking supplies','yarn'],5.0,8,'2025-11-03T10:00:00Z'),
('b7cc2650-df36-45f8-a920-9428089edbf9','jordan_w','Jordan Williams','https://picsum.photos/seed/jordan/200/200','U of M student clearing out dorm stuff every semester. Always down for a good swap.','Binghampton',ARRAY['textbooks','furniture','kitchen stuff'],4.3,6,'2026-01-10T10:00:00Z'),
('8bf44cdb-55f5-4fdd-a048-eb0055fda110','sam_rides','Sam Nguyen','https://picsum.photos/seed/sam/200/200','Bike mechanic and coffee enthusiast. Will fix your bike for homemade cookies.','Overton Square',ARRAY['bike parts','coffee equipment','vinyl records'],4.6,19,'2025-07-22T10:00:00Z'),
('b4061c2d-7c98-4ddd-a086-95e12ec61e20','nina_creates','Nina Rodriguez','https://picsum.photos/seed/nina/200/200','Freelance graphic designer. Trading art supplies and creative services.','South Main Arts District',ARRAY['art supplies','plants','vintage clothing'],4.9,32,'2025-05-15T10:00:00Z'),
('6daf679c-395c-4f64-a956-a71e72b08096','dave_cooks','Dave Morrison','https://picsum.photos/seed/dave/200/200','Home chef with way too many kitchen gadgets. Will trade for gardening help.','East Memphis',ARRAY['gardening help','outdoor furniture','board games'],4.4,11,'2025-10-08T10:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ── Listings ──────────────────────────────────────────────────────────────────
INSERT INTO public.listings (id, title, description, category, condition, seeking, images, user_id, neighborhood, lat, lng, distance_mi, status, created_at) VALUES

('listing-001','Vintage Record Player','Beautiful 1970s turntable in excellent working condition. Plays 33 and 45 RPM. Includes a new stylus and dust cover. Sound quality is warm and rich.','goods','good','Looking for a quality acoustic guitar or keyboard. Open to other musical instruments too.',
ARRAY['https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=600&h=400&fit=crop&q=80','https://images.unsplash.com/photo-1545670723-196ed0954986?w=600&h=400&fit=crop&q=80'],
'bc668087-f272-44b7-9a58-00d36a31be93','Downtown Memphis',35.1495,-90.049,0.3,'active','2026-04-01T14:30:00Z'),

('listing-002','2 Hours of Math Tutoring','Experienced math teacher offering tutoring for middle school through high school level. Algebra, geometry, pre-calc. Patient and encouraging style.','skills',NULL,'Would love homemade meals, baked goods, or household items in return.',
ARRAY['https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&h=400&fit=crop&q=80'],
'3b6e23ce-2a48-41a6-b51a-5d6625c28d26','Midtown',35.1534,-90.0199,0.8,'active','2026-04-02T09:15:00Z'),

('listing-003','KitchenAid Stand Mixer','Classic 5-quart stand mixer in red. Comes with paddle, whisk, and dough hook attachments. Works perfectly — I just upgraded to a bigger model.','goods','like_new','Gardening tools, a nice set of pots for plants, or handyman help around the house.',
ARRAY['https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&h=400&fit=crop&q=80','https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&h=400&fit=crop&q=80'],
'6daf679c-395c-4f64-a956-a71e72b08096','East Memphis',35.1012,-89.9251,1.2,'active','2026-04-03T16:45:00Z'),

('listing-004','Bike Tune-Up Service','Full bike tune-up including brake adjustment, gear indexing, chain lubrication, and tire inspection. I bring my own tools.','services',NULL,'Homemade cookies, coffee beans, or vinyl records. Also open to other offers!',
ARRAY['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop&q=80'],
'8bf44cdb-55f5-4fdd-a048-eb0055fda110','Overton Square',35.1442,-90.0115,0.5,'active','2026-04-03T11:00:00Z'),

('listing-005','Succulent Collection (12 pots)','A dozen healthy, well-rooted succulents in assorted terracotta pots. Includes echeveria, jade, and haworthia varieties.','outdoor',NULL,'Ceramic planters, baking supplies, or yarn for knitting.',
ARRAY['https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=600&h=400&fit=crop&q=80','https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600&h=400&fit=crop&q=80'],
'2b1d31a1-0348-484e-900b-5c3dc16f5b1c','Germantown',35.0867,-89.8101,1.5,'active','2026-04-04T08:30:00Z'),

('listing-006','IKEA Kallax Shelf Unit','White 4x2 Kallax shelf unit. Great condition, no scratches. Disassembled and ready for pickup.','goods','like_new','Textbooks (any subject), a desk lamp, or help moving furniture.',
ARRAY['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=400&fit=crop&q=80'],
'b7cc2650-df36-45f8-a920-9428089edbf9','Binghampton',35.1302,-89.9798,2.1,'active','2026-04-04T13:20:00Z'),

('listing-007','Custom Logo Design','Professional logo design service. Includes 3 initial concepts, 2 rounds of revisions, and final files in SVG, PNG, and PDF.','skills',NULL,'Art supplies (markers, sketchbooks), indoor plants, or vintage clothing.',
ARRAY['https://images.unsplash.com/photo-1626785774625-ddcddc3445e9?w=600&h=400&fit=crop&q=80','https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&h=400&fit=crop&q=80'],
'b4061c2d-7c98-4ddd-a086-95e12ec61e20','South Main Arts District',35.1317,-90.053,0.9,'active','2026-04-05T10:00:00Z'),

('listing-008','Lawn Mowing (up to 1/4 acre)','I will mow your lawn, edge the walkways, and blow off the clippings. I have my own equipment. Available weekends.','services',NULL,'Power tools, electronics, or sports equipment.',
ARRAY['https://images.unsplash.com/photo-1558904541-efa843a96f01?w=600&h=400&fit=crop&q=80'],
'cd4deb82-d7cc-46b3-b015-ba81e3d6034a','Cooper-Young',35.1194,-90.0215,0.2,'active','2026-04-05T15:30:00Z'),

('listing-009','Homemade Sourdough Bread (2 loaves)','Two freshly baked sourdough loaves made with organic flour. Crusty outside, soft inside.','goods',NULL,'Fresh herbs, garden vegetables, or interesting spices.',
ARRAY['https://images.unsplash.com/photo-1585478259715-876acc5be8eb?w=600&h=400&fit=crop&q=80','https://images.unsplash.com/photo-1549931319-a545dcf3bc7b?w=600&h=400&fit=crop&q=80'],
'6daf679c-395c-4f64-a956-a71e72b08096','East Memphis',35.102,-89.924,1.3,'active','2026-04-06T07:00:00Z'),

('listing-010','Mountain Bike — Giant Talon 3','Well-maintained 2022 Giant Talon 3 mountain bike, size medium. New brake pads, recently tuned.','goods','good','Looking for a kayak, camping gear, or 4+ hours of piano lessons.',
ARRAY['https://images.unsplash.com/photo-1511994298241-608e28f14fde?w=600&h=400&fit=crop&q=80','https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=600&h=400&fit=crop&q=80'],
'8bf44cdb-55f5-4fdd-a048-eb0055fda110','Overton Square',35.145,-90.012,0.6,'active','2026-04-06T12:00:00Z'),

('listing-011','Handmade Ceramic Mugs (set of 4)','Four hand-thrown stoneware mugs in earthy glazes. Each one is unique. Dishwasher and microwave safe.','goods','new','Succulents, candles, or a nice cutting board.',
ARRAY['https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&h=400&fit=crop&q=80'],
'2b1d31a1-0348-484e-900b-5c3dc16f5b1c','Germantown',35.087,-89.809,1.4,'active','2026-04-07T09:30:00Z'),

('listing-012','Pet Sitting (weekend)','Experienced pet sitter available for weekend stays. Comfortable with dogs, cats, and small animals.','services',NULL,'Home-cooked meals, bike repair, or household items.',
ARRAY['https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=600&h=400&fit=crop&q=80'],
'b7cc2650-df36-45f8-a920-9428089edbf9','Binghampton',35.131,-89.9785,1.9,'active','2026-04-07T14:00:00Z'),

('listing-013','Raised Garden Bed Kit','Cedar raised garden bed, 4ft x 8ft x 12in. Unassembled, all pieces and hardware included.','outdoor',NULL,'Vegetable seedlings, compost, or someone to help me build a fence.',
ARRAY['https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&h=400&fit=crop&q=80','https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?w=600&h=400&fit=crop&q=80'],
'bc668087-f272-44b7-9a58-00d36a31be93','Downtown Memphis',35.15,-90.048,0.4,'active','2026-04-07T16:30:00Z'),

('listing-014','Watercolor Painting Lessons','Learn watercolor basics in a relaxed one-on-one session. I provide all materials. 2-hour session.','skills',NULL,'Interesting books, vintage finds, or help with website design.',
ARRAY['https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&h=400&fit=crop&q=80'],
'b4061c2d-7c98-4ddd-a086-95e12ec61e20','South Main Arts District',35.132,-90.0525,1.0,'active','2026-04-08T10:00:00Z'),

('listing-015','Vintage Denim Jacket','Classic Levi''s denim jacket from the early 90s. Size medium, broken in beautifully.','goods','good','Vinyl records, a good backpack, or homemade candles.',
ARRAY['https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&h=400&fit=crop&q=80','https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=600&h=400&fit=crop&q=80'],
'b4061c2d-7c98-4ddd-a086-95e12ec61e20','South Main Arts District',35.1325,-90.0528,0.9,'active','2026-04-08T14:30:00Z')
ON CONFLICT (id) DO NOTHING;
