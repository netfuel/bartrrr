-- Trade agreements (migration 009 on top of 004/006): the 79 checks from the
-- original scratch harness, grouped by case.
--   G-01 exchange details      G-05 both signed, terms locked
--   G-02 signing               G-06 cancel and late cancellations
--   G-03 edits clear signatures G-07 flag for review
--   G-04 outsiders             G-08 notifications, operator paths, DEPLOY.md query

select tests.as('trusted');
insert into public.listings (id, title, description, category, seeking, user_id, neighborhood)
select 'listing-t' || g, 'Thing ' || g, 'desc', 'goods', 'anything',
       'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown'
  from generate_series(1, 6) g;

-- Ann offers on six of Bob's listings, Bob accepts each: six agreements
select tests.as('ann');
select public.make_offer('offer-t' || g, 'listing-t' || g, 'msg-t' || g, 'Swap?', array['Item ' || g]) from generate_series(1, 6) g;
select tests.as('bob');
select public.respond_to_offer('offer-t' || g, 'accept', 'msg-ta' || g, 'Deal', '{}') from generate_series(1, 6) g;
select tests.check('G-01', 'six agreements drafted', (select count(*) from public.agreements) = 6);

-- ─── Exchange details, signing, edits ───────────────────────────────────────
select tests.as('ann');
select tests.err('G-02', 'sign without details is refused',
  $$update public.agreements set party_a_signed = true where id = 'agreement-offer-t1'$$, 'before signing');
select tests.err('G-01', 'past exchange time is refused',
  $$update public.agreements set exchange_date = (now() - interval '1 day')::text where id = 'agreement-offer-t1'$$, 'hasn''t happened');
select tests.err('G-01', 'non-date exchange time is refused',
  $$update public.agreements set exchange_date = 'Saturday-ish' where id = 'agreement-offer-t1'$$, 'Pick a date');
select tests.ok('G-01', 'Ann sets details',
  $$update public.agreements set exchange_method = 'in_person',
      exchange_date = to_char((now() + interval '3 days') at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') || '-05:00',
      exchange_location = '  Cossitt Library  ', special_instructions = '   '
    where id = 'agreement-offer-t1'$$);
select tests.check('G-01', 'date stored as UTC ISO', (select exchange_date ~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$' from public.agreements where id = 'agreement-offer-t1'));
select tests.check('G-01', 'place trimmed, blank notes null', (select exchange_location = 'Cossitt Library' and special_instructions is null from public.agreements where id = 'agreement-offer-t1'));
select tests.check('G-01', 'terms_updated_by = Ann', (select terms_updated_by = tests.uid('ann') from public.agreements where id = 'agreement-offer-t1'));
select tests.ok('G-02', 'Ann signs', $$update public.agreements set party_a_signed = true where id = 'agreement-offer-t1'$$);
select tests.err('G-02', 'Ann cannot forge terms_updated_by / cancelled_late',
  $q$do $d$ begin
      update public.agreements set terms_updated_by = 'bbbbbbbb-0000-0000-0000-000000000002', cancelled_late = true where id = 'agreement-offer-t1';
      if (select terms_updated_by = 'bbbbbbbb-0000-0000-0000-000000000002' or cancelled_late from public.agreements where id = 'agreement-offer-t1') then
        raise exception 'forged';
      end if;
      raise exception 'kept server values';
    end $d$ $q$, 'kept server values');

select tests.as('bob');
select tests.ok('G-03', 'Bob edits the place after Ann signed',
  $$update public.agreements set exchange_location = 'Overton Park Shell lawn' where id = 'agreement-offer-t1'$$);
select tests.check('G-03', 'edit cleared Ann''s signature', (select not party_a_signed and not party_b_signed and status = 'pending_signatures' from public.agreements where id = 'agreement-offer-t1'));
select tests.check('G-03', 'terms_updated_by = Bob', (select terms_updated_by = tests.uid('bob') from public.agreements where id = 'agreement-offer-t1'));

select tests.as('cat');
select tests.check('G-04', 'outsider sees nothing', (select count(*) from public.agreements) = 0);
update public.agreements set exchange_location = 'hijack' where id = 'agreement-offer-t1';
select tests.as('bob');
select tests.check('G-04', 'outsider update had no effect', (select exchange_location = 'Overton Park Shell lawn' from public.agreements where id = 'agreement-offer-t1'));

select tests.ok('G-05', 'Bob signs', $$update public.agreements set party_b_signed = true where id = 'agreement-offer-t1'$$);
select tests.as('ann');
select tests.ok('G-05', 'Ann signs again', $$update public.agreements set party_a_signed = true where id = 'agreement-offer-t1'$$);
select tests.check('G-05', 'both signed → active', (select status = 'active' from public.agreements where id = 'agreement-offer-t1'));
select tests.err('G-05', 'details locked once active',
  $$update public.agreements set exchange_location = 'Elsewhere' where id = 'agreement-offer-t1'$$, 'can''t change');

-- ─── Cancel ─────────────────────────────────────────────────────────────────
-- t1: active, swap in 3 days → on-time cancel by Ann
select tests.ok('G-06', 'Ann cancels t1 (3 days out)', $$update public.agreements set status = 'cancelled' where id = 'agreement-offer-t1'$$);
select tests.check('G-06', 't1 not late, stamped by Ann', (select not cancelled_late and cancelled_by = tests.uid('ann') and cancelled_at is not null from public.agreements where id = 'agreement-offer-t1'));
select tests.err('G-06', 'reopen cancelled → active', $$update public.agreements set status = 'active' where id = 'agreement-offer-t1'$$, 'reopened');
select tests.err('G-06', 'reopen cancelled → pending_signatures', $$update public.agreements set status = 'pending_signatures' where id = 'agreement-offer-t1'$$, 'Invalid');
select tests.err('G-06', 'cancelled → completed', $$update public.agreements set status = 'completed' where id = 'agreement-offer-t1'$$, 'Only an active');
select tests.err('G-06', 'cancelled → disputed', $$update public.agreements set status = 'disputed', dispute_reason = 'x' where id = 'agreement-offer-t1'$$, 'Only active or completed');

-- t2: active, swap in 2 hours → late cancel by Bob
select tests.ok('G-06', 'set t2 details (2h out)', $$update public.agreements set exchange_method = 'dropoff', exchange_date = (now() + interval '2 hours')::text, exchange_location = 'Cooper-Young gazebo' where id = 'agreement-offer-t2'$$);
select tests.ok('G-06', 'Ann signs t2', $$update public.agreements set party_a_signed = true where id = 'agreement-offer-t2'$$);
select tests.as('bob');
select tests.ok('G-06', 'Bob signs t2', $$update public.agreements set party_b_signed = true where id = 'agreement-offer-t2'$$);
select tests.ok('G-06', 'Bob cancels t2 (2h out)', $$update public.agreements set status = 'cancelled' where id = 'agreement-offer-t2'$$);
select tests.check('G-06', 't2 late, by Bob', (select cancelled_late and cancelled_by = tests.uid('bob') from public.agreements where id = 'agreement-offer-t2'));
select tests.check('G-06', 'Bob late_cancellations = 1, Ann 0', (select (select late_cancellations from public.users where id = tests.uid('bob')) = 1 and (select late_cancellations from public.users where id = tests.uid('ann')) = 0));
select tests.err('G-06', 'Bob cannot reset his own late_cancellations', $$update public.users set late_cancellations = 0 where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$, 'permission denied');

-- t3: pending, swap in 2 hours → cancel is not late (nothing agreed yet)
select tests.ok('G-06', 'set t3 details (2h out)', $$update public.agreements set exchange_method = 'in_person', exchange_date = (now() + interval '2 hours')::text, exchange_location = 'Library' where id = 'agreement-offer-t3'$$);
select tests.ok('G-06', 'Bob cancels pending t3', $$update public.agreements set status = 'cancelled' where id = 'agreement-offer-t3'$$);
select tests.check('G-06', 'pending cancel not late', (select not cancelled_late from public.agreements where id = 'agreement-offer-t3'));
select tests.check('G-06', 'Bob still at 1 late cancellation', (select late_cancellations = 1 from public.users where id = tests.uid('bob')));

-- ─── Flag for review ────────────────────────────────────────────────────────
select tests.err('G-07', 'flag a pending trade', $$update public.agreements set status = 'disputed', dispute_reason = 'no show' where id = 'agreement-offer-t4'$$, 'Only active or completed');
select tests.ok('G-07', 'set t4 details', $$update public.agreements set exchange_method = 'in_person', exchange_date = (now() + interval '5 days')::text, exchange_location = 'Library' where id = 'agreement-offer-t4'$$);
select tests.ok('G-07', 'Bob signs t4', $$update public.agreements set party_b_signed = true where id = 'agreement-offer-t4'$$);
select tests.as('ann');
select tests.ok('G-07', 'Ann signs t4', $$update public.agreements set party_a_signed = true where id = 'agreement-offer-t4'$$);
select tests.err('G-07', 'flag without a reason', $$update public.agreements set status = 'disputed' where id = 'agreement-offer-t4'$$, 'what went wrong');
select tests.err('G-07', 'flag with blank reason', $$update public.agreements set status = 'disputed', dispute_reason = '   ' where id = 'agreement-offer-t4'$$, 'what went wrong');
select tests.err('G-07', 'flag with a 501-char reason', $$update public.agreements set status = 'disputed', dispute_reason = repeat('x', 501) where id = 'agreement-offer-t4'$$, '500');
select tests.err('G-07', 'reason alone cannot be written', $q$do $d$ begin
    update public.agreements set dispute_reason = 'sneaky' where id = 'agreement-offer-t4';
    if (select dispute_reason is null from public.agreements where id = 'agreement-offer-t4') then raise exception 'ignored'; end if;
  end $d$ $q$, 'ignored');
select tests.ok('G-07', 'Ann flags active t4', $$update public.agreements set status = 'disputed', dispute_reason = ' Bob didn''t show up ' where id = 'agreement-offer-t4'$$);
select tests.check('G-07', 'reason, who, when stored', (select dispute_reason = 'Bob didn''t show up' and disputed_by = tests.uid('ann') and disputed_at is not null from public.agreements where id = 'agreement-offer-t4'));
select tests.err('G-07', 'disputed → active', $$update public.agreements set status = 'active' where id = 'agreement-offer-t4'$$, 'reopened');
select tests.err('G-07', 'disputed → completed', $$update public.agreements set status = 'completed' where id = 'agreement-offer-t4'$$, 'Only an active');
select tests.err('G-07', 'disputed → cancelled', $$update public.agreements set status = 'cancelled' where id = 'agreement-offer-t4'$$, 'can''t be cancelled');
select tests.as('bob');
select tests.err('G-07', 'Bob cannot rewrite Ann''s reason', $q$do $d$ begin
    update public.agreements set dispute_reason = 'Ann lied' where id = 'agreement-offer-t4';
    if (select dispute_reason = 'Bob didn''t show up' from public.agreements where id = 'agreement-offer-t4') then raise exception 'unchanged'; end if;
  end $d$ $q$, 'unchanged');
select tests.check('G-07', 'flagging active trade left trade counts at 0', (select bool_and(trade_count = 0) from public.users where id in (tests.uid('ann'), tests.uid('bob'))));

-- t5: complete, review, then flag → counts and rating unchanged
select tests.ok('G-07', 'set t5 details', $$update public.agreements set exchange_method = 'in_person', exchange_date = (now() + interval '1 day')::text, exchange_location = 'Library' where id = 'agreement-offer-t5'$$);
select tests.ok('G-07', 'Bob signs t5', $$update public.agreements set party_b_signed = true where id = 'agreement-offer-t5'$$);
select tests.as('ann');
select tests.ok('G-07', 'Ann signs t5', $$update public.agreements set party_a_signed = true where id = 'agreement-offer-t5'$$);
select tests.ok('G-07', 'Ann completes t5', $$update public.agreements set status = 'completed' where id = 'agreement-offer-t5'$$);
select tests.ok('G-07', 'Ann reviews Bob 2 stars', $$insert into public.reviews (agreement_id, reviewer_id, reviewee_id, rating) values ('agreement-offer-t5', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 2)$$);
create temp table before_flag as select id, trade_count, reputation_score from public.users where id in (tests.uid('ann'), tests.uid('bob'));
select tests.as('bob');
select tests.ok('G-07', 'Bob flags completed t5', $$update public.agreements set status = 'disputed', dispute_reason = 'Mixer missing a part' where id = 'agreement-offer-t5'$$);
select tests.check('G-07', 'trade counts and ratings unchanged by flag',
  (select bool_and(u.trade_count = b.trade_count and u.reputation_score = b.reputation_score)
     from public.users u join before_flag b using (id)));
select tests.check('G-07', 'trade counts are 1 each', (select bool_and(trade_count = 1) from public.users where id in (tests.uid('ann'), tests.uid('bob'))));
select tests.err('G-07', 'disputed completed → completed again', $$update public.agreements set status = 'completed' where id = 'agreement-offer-t5'$$, 'Only an active');

-- ─── Notifications for the other neighbor ───────────────────────────────────
select tests.as('ann');
select tests.check('G-08', 'Ann told Bob changed details', exists (select 1 from public.notifications where agreement_id = 'agreement-offer-t1' and title = 'Trade details changed' and body like 'Bob %'));
select tests.check('G-08', 'Ann told Bob canceled t2', exists (select 1 from public.notifications where agreement_id = 'agreement-offer-t2' and title = 'Trade canceled' and body like 'Bob canceled%'));
select tests.check('G-08', 'Ann told Bob flagged t5 with reason', exists (select 1 from public.notifications where agreement_id = 'agreement-offer-t5' and title = 'Trade flagged for review' and body like '%Mixer missing a part%'));
select tests.check('G-08', 'Ann not notified of her own cancel', not exists (select 1 from public.notifications where agreement_id = 'agreement-offer-t1' and title = 'Trade canceled'));
select tests.as('bob');
select tests.check('G-08', 'Bob told Ann canceled t1', exists (select 1 from public.notifications where agreement_id = 'agreement-offer-t1' and title = 'Trade canceled' and body like 'Ann canceled%'));
select tests.check('G-08', 'Bob told Ann flagged t4', exists (select 1 from public.notifications where agreement_id = 'agreement-offer-t4' and title = 'Trade flagged for review'));
select tests.check('G-08', 'Bob told both signed on t4', exists (select 1 from public.notifications where agreement_id = 'agreement-offer-t4' and title = 'You''re both signed: time to swap'));

-- ─── Trusted context: operator / delete_account ─────────────────────────────
select tests.as('trusted');
select tests.ok('G-08', 'operator resolves t4 back to active', $$update public.agreements set status = 'active' where id = 'agreement-offer-t4'$$);
select tests.ok('G-08', 'operator marks flagged-completed t5 done again', $$update public.agreements set status = 'completed' where id = 'agreement-offer-t5'$$);
select tests.check('G-08', 'no double count after operator re-completes', (select bool_and(trade_count = 1) from public.users where id in (tests.uid('ann'), tests.uid('bob'))));
select tests.ok('G-08', 'operator re-flags t5 for the DEPLOY query', $$update public.agreements set status = 'disputed' where id = 'agreement-offer-t5'$$);
select tests.ok('G-08', 'delete_account(Cat) is unaffected', $$select public.delete_account('cccccccc-0000-0000-0000-000000000003')$$);
select tests.ok('G-08', 'delete_account(Bob) cancels open agreements', $$select public.delete_account('bbbbbbbb-0000-0000-0000-000000000002')$$);
select tests.check('G-08', 't4 and t6 cancelled with cancelled_at, not late',
  (select bool_and(status = 'cancelled' and cancelled_at is not null and not cancelled_late) from public.agreements where id in ('agreement-offer-t4', 'agreement-offer-t6')));
select tests.check('G-08', 'Ann notified of the system cancel', exists (select 1 from public.notifications where agreement_id = 'agreement-offer-t6' and user_id = tests.uid('ann') and title = 'Trade canceled'));

-- Operator query from DEPLOY.md ("Flagged trades")
select tests.check('G-08', 'DEPLOY.md flagged-trades query lists t5 with who flagged it and why',
  (select count(*) = 1 and bool_and(id = 'agreement-offer-t5' and flagged_by = 'Former neighbor'
                                    and dispute_reason = 'Mixer missing a part' and party_a = 'Ann Alpha')
     from (
       select a.id,
              a.disputed_at,
              flagger.display_name as flagged_by,
              a.dispute_reason,
              pa.display_name as party_a, a.party_a_item,
              pb.display_name as party_b, a.party_b_item,
              a.exchange_date, a.exchange_location,
              a.completed_at
         from public.agreements a
         join public.users pa on pa.id = a.party_a_user_id
         join public.users pb on pb.id = a.party_b_user_id
         left join public.users flagger on flagger.id = a.disputed_by
        where a.status = 'disputed'
        order by a.disputed_at desc nulls last
     ) q));
