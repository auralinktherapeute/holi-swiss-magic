CREATE TEMP TABLE r(name text, ok boolean, info text); GRANT ALL ON r TO authenticated;
SET role authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-00000000000a"}',false) \g /dev/null
DO $$ BEGIN UPDATE therapist_invoice_settings SET devise_defaut='EUR'; INSERT INTO r VALUES('1 direct update blocked',false,'');
EXCEPTION WHEN others THEN INSERT INTO r VALUES('1 direct update blocked',true,SQLERRM); END $$;
DO $$ BEGIN PERFORM change_practice_currency('EUR','texte avertissement suffisamment long','v1','fr',false,'[]'); INSERT INTO r VALUES('2 no ack refused',false,'');
EXCEPTION WHEN others THEN INSERT INTO r VALUES('2 no ack refused',true,SQLERRM); END $$;
DO $$ BEGIN PERFORM change_practice_currency('EUR','texte avertissement suffisamment long','v1','fr',true,'[]'); INSERT INTO r VALUES('3 unconfirmed price refused',false,'');
EXCEPTION WHEN others THEN INSERT INTO r VALUES('3 unconfirmed price refused',true,SQLERRM); END $$;
DO $$ BEGIN PERFORM change_practice_currency('EUR','court','v1','fr',true,'[{"id":"20000000-0000-0000-0000-000000000001","price":110}]'); INSERT INTO r VALUES('4 consent fails => whole change fails',false,'');
EXCEPTION WHEN others THEN INSERT INTO r VALUES('4 consent fails => whole change fails',true,SQLERRM); END $$;
INSERT INTO r SELECT '5 nothing saved after failures', s.devise_defaut='CHF' AND b.price=120 AND b.currency='CHF' AND (SELECT count(*) FROM currency_change_consents)=0, '' FROM therapist_invoice_settings s, billing_services b WHERE s.therapist_id='00000000-0000-0000-0000-00000000000a';
SELECT change_practice_currency('EUR','texte avertissement suffisamment long','v1','fr',true,'[{"id":"20000000-0000-0000-0000-000000000001","price":110}]') \g /dev/null
INSERT INTO r SELECT '6 practice EUR + price 110 EUR (no 120 EUR)', s.devise_defaut='EUR' AND b.price=110 AND b.currency='EUR','' FROM therapist_invoice_settings s, billing_services b WHERE s.therapist_id='00000000-0000-0000-0000-00000000000a';
INSERT INTO r SELECT '7 consent recorded', count(*)=1 AND bool_and(acknowledged AND actor_user_id='10000000-0000-0000-0000-00000000000a' AND old_currency='CHF' AND new_currency='EUR' AND price_confirmations->0->>'old_price'='120'),'' FROM currency_change_consents;
DO $$ BEGIN UPDATE currency_change_consents SET text_version='x'; INSERT INTO r VALUES('8 consent not editable',false,'');
EXCEPTION WHEN others THEN INSERT INTO r VALUES('8 consent not editable',true,SQLERRM); END $$;
DO $$ BEGIN DELETE FROM currency_change_consents; INSERT INTO r VALUES('9 consent not deletable',false,'');
EXCEPTION WHEN others THEN INSERT INTO r VALUES('9 consent not deletable',true,SQLERRM); END $$;
INSERT INTO r SELECT '10 old invoice unchanged', currency='CHF' AND montant_total=120,'' FROM therapist_invoices;
INSERT INTO r SELECT '11 old booking unchanged', currency IS NULL,'' FROM appointments WHERE patient_name='Ancien';
INSERT INTO appointments(therapist_id,patient_name) VALUES('00000000-0000-0000-0000-00000000000a','Nouveau');
INSERT INTO r SELECT '12 new booking snapshot EUR', currency='EUR','' FROM appointments WHERE patient_name='Nouveau';
DO $$ BEGIN UPDATE crm_client_contacts SET billing_currency='CHF'; INSERT INTO r VALUES('13 client direct update blocked',false,'');
EXCEPTION WHEN others THEN INSERT INTO r VALUES('13 client direct update blocked',true,SQLERRM); END $$;
DO $$ BEGIN PERFORM change_client_currency('30000000-0000-0000-0000-000000000001','CHF','texte avertissement suffisamment long','v1','fr',false); INSERT INTO r VALUES('14 client no ack refused',false,'');
EXCEPTION WHEN others THEN INSERT INTO r VALUES('14 client no ack refused',true,SQLERRM); END $$;
SELECT change_client_currency('30000000-0000-0000-0000-000000000001','CHF','texte avertissement client suffisamment long','v1','fr',true) \g /dev/null
INSERT INTO r SELECT '15 client override CHF while practice EUR', billing_currency='CHF','' FROM crm_client_contacts;
INSERT INTO appointments(therapist_id,client_id,patient_name) VALUES('00000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-000000000001','Client');
INSERT INTO r SELECT '16 client booking snapshot CHF', currency='CHF','' FROM appointments WHERE patient_name='Client';
SELECT change_client_currency('30000000-0000-0000-0000-000000000001',NULL,'texte avertissement client suffisamment long','v1','fr',true) \g /dev/null
INSERT INTO r SELECT '17 back to practice default, practice untouched', c.billing_currency IS NULL AND s.devise_defaut='EUR','' FROM crm_client_contacts c, therapist_invoice_settings s WHERE s.therapist_id='00000000-0000-0000-0000-00000000000a';
INSERT INTO r SELECT '18 client consents logged', count(*)=2 AND bool_and(change_type='client_currency_change'),'' FROM currency_change_consents WHERE client_id IS NOT NULL;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-00000000000b"}',false) \g /dev/null
INSERT INTO r SELECT '19 B sees no consents of A', count(*)=0,'' FROM currency_change_consents;
DO $$ BEGIN PERFORM change_client_currency('30000000-0000-0000-0000-000000000001','EUR','texte avertissement suffisamment long','v1','fr',true); INSERT INTO r VALUES('20 B cannot change A client',false,'');
EXCEPTION WHEN others THEN INSERT INTO r VALUES('20 B cannot change A client',true,SQLERRM); END $$;
DO $$ BEGIN INSERT INTO currency_change_consents(therapist_id,change_type,old_currency,new_currency,warning_text,text_version,text_language,acknowledged,actor_user_id) VALUES('00000000-0000-0000-0000-00000000000b','practice_currency_change','CHF','EUR','texte avertissement suffisamment long','v1','fr',true,auth.uid()); INSERT INTO r VALUES('21 no direct insert',false,'');
EXCEPTION WHEN others THEN INSERT INTO r VALUES('21 no direct insert',true,SQLERRM); END $$;
RESET role;
SET role anon;
DO $$ BEGIN PERFORM change_practice_currency('EUR','x','v1','fr',true,'[]'); EXCEPTION WHEN others THEN RAISE NOTICE 'anon: %', SQLERRM; END $$;
RESET role;
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, name, left(info,60) FROM r ORDER BY split_part(name,' ',1)::int;
