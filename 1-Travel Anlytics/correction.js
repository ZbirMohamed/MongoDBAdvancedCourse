// Pour mieux visualiser vos requêtes et les pipelines, utilisez MongoDB Compass.

// 1er - Question

// Trouver les 5 utilisateurs ayant dépensé le plus en 2023
[
  // Tout d'abord, nous commençons par restreindre notre pipeline (narrowing the pipeline) pour récupérer les données nécessaires.
  // Si on commence par chercher la liste des paiements, on va augmenter la quantité de données, ce qui complique inutilement la recherche.
  // NB : Lorsque vous écrivez une requête NoSQL, ne vous limitez pas à une quantité de données locale mais imaginez une base de données de taille astronomique.
  // Chaque étape du pipeline doit cibler et réduire la zone de recherche.

  {
    $match: {
      $expr: {
        $and: [
          {
            $lte: [
              { $dateFromString: { dateString: "$booking_date" } },
              ISODate("2023-12-31T23:59:59Z"),
            ],
          },
          {
            $gte: [
              { $dateFromString: { dateString: "$booking_date" } },
              ISODate("2023-01-01T00:00:00Z"),
            ],
          },
        ],
      },
    },
  },

  // Maintenant que nous avons les réservations entre les dates souhaitées, nous pouvons rechercher les paiements associés
  {
    $lookup: {
      // Cette étape permet de faire une jointure dans MongoDB
      from: "payments", // from == le document externe (ou collection)
      localField: "_id", // Champ de clé primaire dans le document local
      foreignField: "booking_id", // Champ de clé étrangère dans le document externe
      as: "payments", // Alias pour créer un tableau contenant les documents correspondants
    },
  },

  // Nous allons "découper" (unwind) la liste des paiements pour pouvoir calculer le montant total dépensé par chaque utilisateur
  {
    $unwind: "$payments", // Unwind == déstructuration d'une liste en documents individuels
  },

  // Ici, nous regroupons nos résultats pour chaque utilisateur
  {
    $group: {
      _id: "$user_id", // Champ de regroupement
      total_spent: {
        // Alias pour le total dépensé
        $sum: "$payments.total_price", // NB : Il est nécessaire d'utiliser les operations d'aggragations pour chaque champs rendu dans le group by
      }, // de plus vous pouvez ajouter d'autres expressions sous les fonctions d'aggregations ex : $sum: {$cond: [{ $eq: ["$year", 2023] }, "$amount", 0]}  vous pouvez utliser des conditions des operations etc ...
    },
  },

  // On trie les résultats par montant total dépensé en ordre décroissant
  {
    $sort: {
      total_spent: -1,
    },
  },

  // On limite la sortie aux 5 utilisateurs ayant dépensé le plus
  {
    $limit: 5,
  },
][
  // 2eme - Question

  //Identifier les destinations les plus populaires pour les vols durant l'été 2023.
  // Réduire la zone de recherche aux vols réservés pendant l'été 2023
  {
    $match: {
      // Attention : les dates sont au format string
      booking_date: { $regex: /^2023-(0[6-9])/ }, // Filtrer pour les dates de juin à septembre 2023
    }, //  /^2023 == commence par 2023 ,  -(0[6-9]) == commence par -0 et se termine avec un nombre entre 6 et 9
  }, // ce qui nous donne 06 07 08 09 ce sont les mois d'ete
  // il y'a d'autres methodes comme le casting des dates de str a date (  NB : il faut utiliser $expr parceque vous aurez un traitment complexe dans votre match )
  // Associer les services (comme les destinations) en utilisant une jointure avec $lookup
  {
    $lookup: {
      from: "services",
      localField: "service_id", // Champ de clé étrangère dans le document actuel
      foreignField: "_id", // Clé primaire dans le document cible (services)
      as: "service",
    },
  },
  // Décomposer le tableau 'service' résultant du $lookup
  {
    $unwind: "$service",
  },
  // Grouper par destination pour compter le nombre de fois qu'elle apparaît
  {
    $group: {
      _id: "$service.destination", // Groupement par destination
      popular_destination: {
        $sum: 1, // Compteur d'apparition pour chaque destination
      },
    },
  },
  // Trier par nombre d'apparitions (populaire) en ordre décroissant
  {
    $sort: {
      popular_destination: -1,
    },
  },
  // Limiter le résultat au top 1 des destinations les plus populaires
  {
    $limit: 1,
  }
][
  // 3eme - Question
  //Trouver l'utilisateur ayant le plus de points de fidélité qui n'a pas effectué de réservation au cours des 6 derniers mois.
  // On commence par trier les réservations par date de façon décroissante
  {
    $sort: {
      booking_date: -1,
    },
  },
  // On regroupe par utilisateur pour récupérer la dernière réservation de chaque utilisateur
  {
    $group: {
      _id: "$user_id",
      latestBooking: {
        $first: "$$ROOT", // Utilise $first pour obtenir la première (plus récente) réservation de chaque utilisateur
      },
    },
  },
  // Ajout d'un champ pour calculer la différence en mois entre la dernière réservation et la date actuelle
  {
    $addFields: {
      dateDiffMonths: {
        // Alias pour la différence en mois
        $dateDiff: {
          startDate: {
            $dateFromString: { dateString: "$latestBooking.booking_date" },
          }, // Date de la dernière réservation
          endDate: new Date(), // Date actuelle
          unit: "month", // Unité pour le calcul (ici en mois)
        },
      },
    },
  },
  // Filtre pour garder uniquement les utilisateurs n'ayant pas fait de réservation depuis au moins 6 mois
  {
    $match: {
      dateDiffMonths: { $gte: 6 },
    },
  },
  // Jointure avec la collection "users" pour obtenir les informations de chaque utilisateur
  {
    $lookup: {
      from: "users",
      localField: "_id",
      foreignField: "_id",
      as: "user",
    },
  },
  // Trie les utilisateurs par points de fidélité, du plus élevé au plus bas
  {
    $sort: {
      "user.loyalty_points": -1,
    },
  },
  // Limite le résultat au premier utilisateur, celui avec le plus de points de fidélité
  {
    $limit: 1,
  }
][
  // 4eme - Question

  // Filtrer les réservations supérieures à 1 000 $
  {
    $match: {
      amount: { $gt: 1000 }
    }
  },
  
  // Grouper les réservations par méthode de paiement et compter les occurrences
  {
    $group: {
      _id: "$payment_method",  // Groupe par méthode de paiement
      count: { $sum: 1 }       // Compte le nombre de fois où chaque méthode de paiement est utilisée
    }
  },
  
  //Trier par nombre d'occurrences de façon décroissante
  {
    $sort: {
      count: -1  
    }
  },
  
  // Grouper pour calculer la méthode de paiement la plus utilisée (en cas d'égalité des comptes)
  {
    $group: {
      _id: null,               // Aucun groupe spécifique, on fait un seul groupe
      maxCount: { $first: "$count" },  // On récupère la valeur maximale de "count"
      payments: {
        $push: { _id: "$_id", count: "$count" }  // On rassemble toutes les méthodes et leurs counts dans un tableau
      }
    }
  },
  
  //Filtrer pour ne garder que les méthodes ayant le nombre d'utilisations maximal
  {
    $project: {
      _id: 0,  // On ne garde pas le champ _id
      topPayementMethods: { 
        $filter: {  // On filtre la liste des paiements pour ne garder que ceux avec le count maximum
          input: "$payments",  // Tableau des méthodes de paiement
          as: "pay",            // Nom de la variable temporaire pour chaque élément du tableau
          cond: { $eq: ["$$pay.count", "$maxCount"] }  // Condition : on garde seulement les éléments dont le count est égal à maxCount
        }
      }
    }
  },
  
  // Décomposer le tableau de méthodes de paiement filtré
  { 
    $unwind: "$topPayementMethods"  // Décompose le tableau des méthodes de paiement les plus utilisées
  }
];
[   // On commence par eliminer les reservation annuler 
    {
      $match: {
        status:{$regex : "cancelled" , $options : "i"}
      }
    },
    // On regroupe les reservations avec les clients associes  
    {
      $lookup: {
        from: "users",
        localField: "user_id",
        foreignField: "_id",
        as: "user"
      }
    },
    //Puis on filtre les utilisateurs avec les points de fidelites sup a 500
  	{
    $match: {
      "user.loyalty_points" : {$gt:500}
    }
  	},
    // On decompose la liste des utilisateur
    {
      $unwind:"$user"
    },
    //puis on calcule le nombre des reservations 
    {
      $group: {
        _id: "$user_id",
        bookingCancelled: {
          $sum: 1
        }
      }
    },
    {
      $match: {
        bookingCancelled : {$gte : 3}
      }
    }
  ]
// je pense que maintenant vous etes apte est capable a comprendre les requetes sans aucune explications
  [
    {
      $match: {
        status :  "confirmed" ,
        booking_date : { $regex : /2023/  }
      }
    },
    {
      $lookup: {
        from: "services",
        localField: "service_id",
        foreignField: "_id",
        as: "service"
      }
    },
    {$unwind:"$service"},
    {
      $group: {
        _id: "$service.type",
        totalRevenue: {
            $sum: { $ifNull: ["$total_price", 0] } // le $ifNull n'est qu'un ajout (non necessaire) mais pour vous montrer une methode lorsque vous cumuler des entiers il se peut qu'un document n'a pas le champs ou que la valeurs est null .
            //ce n'est qu'une musure de securiter
        }
      }
    }
  ]