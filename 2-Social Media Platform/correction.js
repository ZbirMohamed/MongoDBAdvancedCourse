1 - // posts
[
  {
    $lookup: {
      from: "users",
      localField: "user_id",
      foreignField: "_id",
      as: "user"
    }
  },
  {
    $group: {
      _id: "$user_id",
      //comme on l'a disscute avant pour ajouter un champs dans le group by il faut utiliser une methode d'aggregation (ex : first )
      name : {$first : {$arrayElemAt :[ "$user.username"/* simple table manipulation  */ ,0 /* index */]}}, // une nouvelle fonctionalite au lieu de fair le unwind pour retrouvez l'objet user
      //$arrayElemAt vous aide a trouver l'element dont l'index est connue est bien sur puisque c'est un objet vous pouvez alors prendre le champs voulue dans notre cas c'est le nom
      numberOfComments: { $sum: { $size: { $ifNull: ["$comments", []] } } }, 
      numberOfPosts: {
        $sum: 1
      }
    }
  },
  {
    $sort: {
      numberOfPosts: -1
    }
  },
  {$limit: 5}
]

2- // comments
[
    {
      $match: {created_at : {$gte :'2024-09-28'}}, // j'ai utiliser cette parceque les donnes sont limiter a ceci
    },
    {
      $group: {
        _id: "$post_id",
        comments: {
         // $push: "$$ROOT == variable de system elle represente l'etat original complet (tout simplement tout le document lors du stage 1 tout changement n'est pas pris on consideration) du document  " // ceci va ajouter tout le document dans la liste  (racine)
          $push: "$content"  // ceci va pousser que le champ content
        }
      }
    },
    {
      $lookup: {
        from: "posts",
        localField: "_id",
        foreignField: "_id",
        as: "post"
      }
    },
    {
      $project: {
        content : {$first : "$post.content"},
        comments : "$comments"
      }
    } 
]

3- //posts
[
    {$addFields:
      {
      likeStatus: 
      // on vas utiliser les condtions pour retourner des valeurs boolean
          {$cond :{ // $cond : {  if , then , else    }
          if:{
            $in : ["user1",{$ifNull : ["$likes",[]] }] // deposer le user suppose connecter
          },
          then:true,
          else:false }
        }
        }
    },
    {
      $project: {
        likeStatus : 1,
        content:1,
        created_at:1
      }
    }
  
  ];

  4- // (utiliser mongosh)
// let pageSize;// nombre de commentaire voulue
//let pageNumber = 2; // la page voulue

//let skipNumber = (pageNumber - 1) * pageSize; // calcule des elements a depasse

[
  {
			$match : 
			{
				$expr:
				{
						$gt:['$comments',0] // vous pouvez utiliser le ifNull ici aussi ci la requete ne marche pas
				}				
			}
	},
{$skip : pageNumber},
{
	$limit:pageSize
}
];

5-
//!!Attention mongoDB ne peut avoir qu'UN SEUL index de type text MAIS il vous permet de COMBINER les champs de type TEXT.
db.posts.createIndex({ title: "text", content: "text" });
//CECI va combiner l'index de recherche pour titre et contenu 
//ci vous cherchez alors vous aurez des resultats pour les deux et puis vous pouvez filtrer les données non voulues
[
  {
    $match: {
      $text:{
        $search : "Amazing"
      }
    }
  },
  {
    $addFields: {
      score: {$meta: "textScore"   }
    }
  }
  ,
  {
    $sort: {
      score: -1
    }
  }
]
//ceci va vous permettre de cree des recherche comme celle que vous avez sur instagram par exemple : (on tape le nom on trouve alors les users , des hashtags +++)
//MAIS SACHAIT BIEN QUE SEARCH A BESOIN PLUS DE PERFORMANCE QU'UNE SIMPLE MATCH 

6-
//j'ai utiliser le reduce pour rassembler les id en une seul chaine 
[
  {
    $group: {
      _id: "$content",
      duplicate: {
        $sum: 1
      },
      postId:{$push: "$_id" }
    }
  },
  {
		$project: {
		  joinedIds : {
        $reduce:{ // ce n'est qu'un jeu avec mongodb c'est a vous de voir comment vous voulez afficher vos resultats
          input : "$postId",
          initialValue:"",
          in:{ // ici on lui demande si la valeur initial de reduce est vide alors prend le pemier element de notre liste comme element initial sinon concatene les deux
            $cond:{
              if:{$eq:["$$value",'']},
              then:"$$this",
              else:{$concat: ["$$value", ", ", "$$this"]}
            }
          }
        }
      }
		}    
  }
]

7-
//Tout d'abord visualiser la requete dans l'aggregation pipelines pour savoir si le changements passent sans aucun soucis
//Apres que votre controle de conformiter et bon utiliser la requetes antecedantes pour lancer votre update
// agg
[
  {
    $match: { "_id": "post2" }
  },
  {
    $set: {
      likes: {
        $cond: { // une condition pour savoir si l'utilisateur existe dans la liste des likes
          if: { $in: ["user2", "$likes"] }, // si il existe alors il faut l'enlever de la liste
          then: { $setDifference: ["$likes", ["user2"]] },  // ici on l'enleve
          else: { $concatArrays: ["$likes", ["user2"]] } // sinon on n'ajour le user puisque c'est complexe on peut pas utiliser pish alors on opte pour une deuxieme methode c'est la concatenation des listes
        }
      }
    }
  }
]
//Apres check on update 
// update
db.posts.updateOne(
  { _id: "post2" },
  [
    {
      $set: {
        likes: {
          $cond: {
            if: { $in: ["user2", "$likes"] },
            then: { $setDifference: ["$likes", ["user2"]] },
            else: { $concatArrays: ["$likes", ["user2"]] }
          }
        }
      }
    }
  ]
);