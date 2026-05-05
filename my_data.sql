--
-- PostgreSQL database dump
--

\restrict wUCjF0hjVmr0qBUBobboLIAkQDYuUxayPqaDzAhiyz9CMZ58GMyifcKgafB3sju

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

-- Started on 2026-03-18 09:48:36

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5306 (class 0 OID 16777)
-- Dependencies: 240
-- Data for Name: ai_questions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5304 (class 0 OID 16767)
-- Dependencies: 238
-- Data for Name: card_styles; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5316 (class 0 OID 17030)
-- Dependencies: 250
-- Data for Name: cards_unlock; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5321 (class 0 OID 17117)
-- Dependencies: 255
-- Data for Name: collections; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5327 (class 0 OID 17241)
-- Dependencies: 261
-- Data for Name: community_comment_likes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5314 (class 0 OID 16914)
-- Dependencies: 248
-- Data for Name: community_comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.community_comments VALUES (1, 9, 2, NULL, '測試留言', '2026-03-17 13:51:08.6159+08', NULL);


--
-- TOC entry 5324 (class 0 OID 17185)
-- Dependencies: 258
-- Data for Name: community_post_likes; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.community_post_likes VALUES (9, 2, '2026-03-13 13:25:47.603011+08');
INSERT INTO public.community_post_likes VALUES (16, 2, '2026-03-17 13:47:19.609982+08');
INSERT INTO public.community_post_likes VALUES (16, 58, '2026-03-17 15:56:39.808746+08');


--
-- TOC entry 5326 (class 0 OID 17207)
-- Dependencies: 260
-- Data for Name: community_post_shares; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.community_post_shares VALUES (1, 16, 22, 2, '我想要轉發這則貼文', '2026-03-17 14:49:50.797568', NULL);


--
-- TOC entry 5310 (class 0 OID 16826)
-- Dependencies: 244
-- Data for Name: community_posts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.community_posts VALUES (8, 2, NULL, '123test', 'normal', 'public', '2026-03-13 09:26:05.051989+08', NULL, '{test}', NULL, 0, 0, 0);
INSERT INTO public.community_posts VALUES (10, 2, NULL, '第10次測試，兩tags', 'normal', 'public', '2026-03-13 09:31:27.222519+08', NULL, '{test,happy}', NULL, 0, 0, 0);
INSERT INTO public.community_posts VALUES (11, 2, NULL, '第11次測試', 'normal', 'public', '2026-03-13 12:56:46.03423+08', NULL, '{test}', NULL, 0, 0, 0);
INSERT INTO public.community_posts VALUES (12, 2, NULL, '第12次測試', 'normal', 'public', '2026-03-13 12:57:43.661772+08', '2026-03-16 00:02:57.34874+08', '{test}', NULL, 0, 0, 0);
INSERT INTO public.community_posts VALUES (15, 2, NULL, '第13次
測試', 'normal', 'group', '2026-03-16 00:18:00.754709+08', NULL, '{test}', NULL, 0, 0, 0);
INSERT INTO public.community_posts VALUES (9, 2, NULL, '第9次測試', 'normal', 'public', '2026-03-13 09:29:36.920202+08', NULL, '{test}', NULL, 1, 0, 1);
INSERT INTO public.community_posts VALUES (22, 2, NULL, '我想要轉發這則貼文', 'shared', 'public', '2026-03-17 14:49:50.797568+08', NULL, NULL, NULL, 0, 0, 0);
INSERT INTO public.community_posts VALUES (16, 2, NULL, '第16次測試', 'normal', 'public', '2026-03-17 13:47:05.355457+08', NULL, '{test}', NULL, 2, 1, 0);
INSERT INTO public.community_posts VALUES (23, 58, NULL, '發送新的貼文，要說什麼?', 'normal', 'public', '2026-03-17 15:57:03.177375+08', NULL, '{test}', NULL, 0, 0, 0);


--
-- TOC entry 5294 (class 0 OID 16569)
-- Dependencies: 228
-- Data for Name: conversation_forks; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5288 (class 0 OID 16463)
-- Dependencies: 222
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5319 (class 0 OID 17087)
-- Dependencies: 253
-- Data for Name: covers; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5323 (class 0 OID 17137)
-- Dependencies: 257
-- Data for Name: diary; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.diary VALUES (4, NULL, '晚開學', '多放兩天，上兩天課又休假', '["生活"]', NULL, '2026-02-24 16:49:25.104629+08', '2026-02-24', 2);
INSERT INTO public.diary VALUES (6, NULL, '聖誕節', '今天是聖誕節', '["生日"]', '天主在天受光榮，主愛的人在世享平安。(路加福音2:14)', '2026-02-24 17:19:18.181961+08', '2026-02-24', 2);
INSERT INTO public.diary VALUES (7, NULL, '測試', '測試', '["聖誕"]', '天主在天受光榮，主愛的人在世享平安。', '2026-02-24 21:20:46.793254+08', '2026-02-24', 2);
INSERT INTO public.diary VALUES (12, NULL, '123', '123', '["life"]', '123', '2026-02-26 01:03:07.339088+08', '2026-02-23', 2);
INSERT INTO public.diary VALUES (15, NULL, '567', '日記測試', '["love"]', '愛是恆久忍耐（林前13:4）', '2026-03-03 14:40:34.488569+08', '2026-03-02', 2);
INSERT INTO public.diary VALUES (16, NULL, '專題開會', '今日開會測試', '["test"]', '不要害怕，只管信。 (路 8：50)', '2026-03-17 13:41:36.077544+08', '2026-03-17', 2);


--
-- TOC entry 5302 (class 0 OID 16747)
-- Dependencies: 236
-- Data for Name: letters; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5296 (class 0 OID 16604)
-- Dependencies: 230
-- Data for Name: message_citation; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5292 (class 0 OID 16513)
-- Dependencies: 226
-- Data for Name: message_versions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5290 (class 0 OID 16484)
-- Dependencies: 224
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5298 (class 0 OID 16626)
-- Dependencies: 232
-- Data for Name: search_queries; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5286 (class 0 OID 16391)
-- Dependencies: 220
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: Iris
--

INSERT INTO public."user" VALUES (52, '賴思嘉', 'https://lh3.googleusercontent.com/a/ACg8ocK6Arb6sfCv8o1ranOUNB06oKKQbiu4dGNaMGLnA1Ug7Hd0rgxu=s96-c', NULL, '2026-03-17', 'GYSsctuX4aagNcdlmhd2teox41j2');
INSERT INTO public."user" VALUES (53, 'Ting Kao', 'https://lh3.googleusercontent.com/a/ACg8ocL6KqtwGvOp8pU60uzp8yuPbVdqPResSTXId4eZm6ZDKT-YS8B73Q=s96-c', NULL, '2026-03-17', 'LZhj38IK5gRpFAduEpDpsx90FGa2');
INSERT INTO public."user" VALUES (1, 'hahaha', 'https://lh3.googleusercontent.com/a/ACg8ocKue3oT7UyvFNSm7ji9rtVPIRzbdqhIX7Emh-T9uyaLZJoXUFg=s96-c', NULL, '2026-02-15', 'z1JjumyVFIfZcg7apmLlbdAyrw93');
INSERT INTO public."user" VALUES (56, '旻翰', 'https://lh3.googleusercontent.com/a/ACg8ocJiJr7MARQf1DqdR5e-ZXpUhOl_Ytja1RsWiI2UTm_LCzPoziv7=s96-c', NULL, '2026-03-17', 'zY8ZNPMmOhhmJoyosrP5Mp1eCCu1');
INSERT INTO public."user" VALUES (2, '李欣頤', 'https://lh3.googleusercontent.com/a/ACg8ocJeD529YuYGLxu3qipAAP4cgTOv8ku2oS_vKNVbRim1eCFd3XQn=s96-c', '', '2026-02-20', 'tC7nX2XyrQOLxS8batDxHKZDKX03');
INSERT INTO public."user" VALUES (58, '時Iris', 'https://lh3.googleusercontent.com/a/ACg8ocL7gFnKJsPyM8EKVk-ixIAcRPNEGay02TOhx5-TqeC_R7B3iXs=s96-c', '', '2026-03-17', 'at0oiHAMkuf137qcYXciepl1L5I2');


--
-- TOC entry 5312 (class 0 OID 16857)
-- Dependencies: 246
-- Data for Name: user_cards; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5300 (class 0 OID 16710)
-- Dependencies: 234
-- Data for Name: user_draws; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5317 (class 0 OID 17069)
-- Dependencies: 251
-- Data for Name: user_follow; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5308 (class 0 OID 16787)
-- Dependencies: 242
-- Data for Name: weekly_cards; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5337 (class 0 OID 0)
-- Dependencies: 239
-- Name: ai_questions_ai_question_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ai_questions_ai_question_id_seq', 1, false);


--
-- TOC entry 5338 (class 0 OID 0)
-- Dependencies: 237
-- Name: card_styles_card_style_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.card_styles_card_style_id_seq', 1, false);


--
-- TOC entry 5339 (class 0 OID 0)
-- Dependencies: 249
-- Name: cards_unlock_inlock_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cards_unlock_inlock_id_seq', 1, false);


--
-- TOC entry 5340 (class 0 OID 0)
-- Dependencies: 254
-- Name: collections_collect_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.collections_collect_id_seq', 1, false);


--
-- TOC entry 5341 (class 0 OID 0)
-- Dependencies: 247
-- Name: community_comments_comment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.community_comments_comment_id_seq', 1, true);


--
-- TOC entry 5342 (class 0 OID 0)
-- Dependencies: 259
-- Name: community_post_shares_share_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.community_post_shares_share_id_seq', 1, true);


--
-- TOC entry 5343 (class 0 OID 0)
-- Dependencies: 243
-- Name: community_posts_community_post_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.community_posts_community_post_id_seq', 23, true);


--
-- TOC entry 5344 (class 0 OID 0)
-- Dependencies: 227
-- Name: conversation_forks_conversation_forks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.conversation_forks_conversation_forks_id_seq', 1, false);


--
-- TOC entry 5345 (class 0 OID 0)
-- Dependencies: 221
-- Name: conversations_conversation_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.conversations_conversation_id_seq', 1, false);


--
-- TOC entry 5346 (class 0 OID 0)
-- Dependencies: 252
-- Name: covers_diary_cover_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.covers_diary_cover_id_seq', 1, false);


--
-- TOC entry 5347 (class 0 OID 0)
-- Dependencies: 256
-- Name: diary_diary_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.diary_diary_id_seq', 16, true);


--
-- TOC entry 5348 (class 0 OID 0)
-- Dependencies: 235
-- Name: letters_letter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.letters_letter_id_seq', 1, false);


--
-- TOC entry 5349 (class 0 OID 0)
-- Dependencies: 229
-- Name: message_citation_citation_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.message_citation_citation_id_seq', 1, false);


--
-- TOC entry 5350 (class 0 OID 0)
-- Dependencies: 225
-- Name: message_versions_message_version_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.message_versions_message_version_id_seq', 1, false);


--
-- TOC entry 5351 (class 0 OID 0)
-- Dependencies: 223
-- Name: messages_message_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.messages_message_id_seq', 1, false);


--
-- TOC entry 5352 (class 0 OID 0)
-- Dependencies: 231
-- Name: search_queries_search_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.search_queries_search_id_seq', 1, false);


--
-- TOC entry 5353 (class 0 OID 0)
-- Dependencies: 245
-- Name: user_cards_card_files_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_cards_card_files_id_seq', 1, false);


--
-- TOC entry 5354 (class 0 OID 0)
-- Dependencies: 233
-- Name: user_draws_user_draws_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_draws_user_draws_id_seq', 1, false);


--
-- TOC entry 5355 (class 0 OID 0)
-- Dependencies: 219
-- Name: user_userID_seq; Type: SEQUENCE SET; Schema: public; Owner: Iris
--

SELECT pg_catalog.setval('public."user_userID_seq"', 72, true);


--
-- TOC entry 5356 (class 0 OID 0)
-- Dependencies: 241
-- Name: weekly_cards_weekly_cards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.weekly_cards_weekly_cards_id_seq', 1, false);


-- Completed on 2026-03-18 09:48:37

--
-- PostgreSQL database dump complete
--

\unrestrict wUCjF0hjVmr0qBUBobboLIAkQDYuUxayPqaDzAhiyz9CMZ58GMyifcKgafB3sju

