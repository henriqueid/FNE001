update private.access_users
set email = 'henriquemdsid2@gmail.com',
    updated_at = now()
where user_id = 'user-henrique-admin'
  and email = 'henrique@strato.local';
